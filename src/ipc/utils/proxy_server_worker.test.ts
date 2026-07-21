import http from "node:http";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Server did not bind to a TCP port"));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => resolve(Buffer.concat(chunks).toString()));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

describe("preview proxy worker", () => {
  const workers: Worker[] = [];
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(workers.splice(0).map((worker) => worker.terminate()));
    await Promise.all(servers.splice(0).map((server) => close(server)));
  });

  it("survives a client abort during a streamed response", async () => {
    const upstream = http.createServer((request, response) => {
      if (request.url === "/slow") {
        response.writeHead(200, { "content-type": "application/octet-stream" });
        response.write("first");
        setTimeout(() => {
          if (!response.destroyed) response.end("second");
        }, 100);
        return;
      }
      response.end("still-alive");
    });
    servers.push(upstream);
    const upstreamPort = await listen(upstream);

    const portReservation = http.createServer();
    const proxyPort = await listen(portReservation);
    await close(portReservation);

    const worker = new Worker(
      path.resolve(process.cwd(), "worker/proxy_server.js"),
      {
        workerData: {
          targetOrigin: `http://127.0.0.1:${upstreamPort}`,
          port: proxyPort,
          listenHost: "127.0.0.1",
          fallbackPortStart: proxyPort + 1,
          maxPortAttempts: 3,
        },
      },
    );
    workers.push(worker);

    await new Promise<void>((resolve, reject) => {
      worker.once("error", reject);
      worker.on("message", (message) => {
        if (String(message).startsWith("proxy-server-start url=")) resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      const request = http.get(
        `http://127.0.0.1:${proxyPort}/slow`,
        (response) => {
          response.once("data", () => {
            response.destroy();
            request.destroy();
            resolve();
          });
        },
      );
      request.once("error", (error) => {
        if ((error as NodeJS.ErrnoException).code !== "ECONNRESET")
          reject(error);
      });
    });

    expect(await get(`http://127.0.0.1:${proxyPort}/ok`)).toBe("still-alive");
    expect(worker.threadId).toBeGreaterThan(0);
  });
});
