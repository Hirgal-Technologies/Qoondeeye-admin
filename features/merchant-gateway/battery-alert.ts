export type BatteryAlertLevel = "low" | "critical";

export function batteryAlertLevel(value: unknown): BatteryAlertLevel | null {
  if (value === "low" || value === "critical") return value;
  return null;
}

export function batteryWarningLabel(level: BatteryAlertLevel | null): string | null {
  if (level === "low") return "Battery low";
  if (level === "critical") return "Battery critical";
  return null;
}

const BATTERY_WARNING_KINDS = new Set(["gateway_battery_low", "gateway_battery_critical"]);

/**
 * A later battery recovery clears earlier low and critical warnings
 * for the same device. Connectivity alerts are left unchanged.
 */
export function batteryWarningCleared(
  alert: { deviceId: string; kind: string; at: string },
  alerts: ReadonlyArray<{ deviceId: string; kind: string; at: string }>,
): boolean {
  if (!BATTERY_WARNING_KINDS.has(alert.kind)) return false;
  return alerts.some(
    (other) =>
      other.deviceId === alert.deviceId &&
      other.kind === "gateway_battery_recovered" &&
      other.at > alert.at,
  );
}
