import { networkInterfaces } from "node:os";
import { systemContracts } from "../types/system";
import { createTypedHandler } from "./base";

export function registerNetworkHandlers() {
  createTypedHandler(systemContracts.getNetworkAddress, async () => {
    const interfaces = networkInterfaces();
    for (const addrs of Object.values(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }
    return null;
  });
}
