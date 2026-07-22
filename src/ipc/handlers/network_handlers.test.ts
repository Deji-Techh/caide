import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { selectNetworkAddress } from "./network_handlers";

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:00:00:00:00:00",
    internal,
    cidr: `${address}/24`,
  };
}

describe("selectNetworkAddress", () => {
  it("prefers a physical private LAN over VPN and container interfaces", () => {
    expect(
      selectNetworkAddress({
        tailscale0: [ipv4("100.112.229.44")],
        docker0: [ipv4("172.17.0.1")],
        wlan0: [ipv4("192.168.1.76")],
      }),
    ).toBe("192.168.1.76");
  });

  it("falls back to a usable virtual address when it is the only route", () => {
    expect(
      selectNetworkAddress({
        lo: [ipv4("127.0.0.1", true)],
        tailscale0: [ipv4("100.112.229.44")],
      }),
    ).toBe("100.112.229.44");
  });

  it("ignores link-local and internal addresses", () => {
    expect(
      selectNetworkAddress({
        lo: [ipv4("127.0.0.1", true)],
        wlan0: [ipv4("169.254.10.20")],
      }),
    ).toBeNull();
  });
});
