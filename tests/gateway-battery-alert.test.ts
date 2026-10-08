import assert from "node:assert/strict";
import test from "node:test";
import {
  batteryAlertLevel,
  batteryWarningCleared,
  batteryWarningLabel,
} from "../features/merchant-gateway/battery-alert.ts";

test("battery recovery clears the active low and critical warnings", () => {
  const alerts = [
    { deviceId: "galaxy", kind: "gateway_battery_low", at: "2026-10-08T18:00:00.000Z" },
    { deviceId: "galaxy", kind: "gateway_battery_critical", at: "2026-10-08T19:00:00.000Z" },
    { deviceId: "galaxy", kind: "gateway_battery_recovered", at: "2026-10-08T20:00:00.000Z" },
    { deviceId: "other", kind: "gateway_battery_low", at: "2026-10-08T18:30:00.000Z" },
  ];
  assert.equal(batteryWarningCleared(alerts[0], alerts), true);
  assert.equal(batteryWarningCleared(alerts[1], alerts), true);
  assert.equal(batteryWarningCleared(alerts[3], alerts), false);
  assert.equal(batteryWarningLabel("low"), "Battery low");
  assert.equal(batteryWarningLabel("critical"), "Battery critical");
  assert.equal(batteryWarningLabel(null), null);
  assert.equal(batteryAlertLevel("critical"), "critical");
  assert.equal(batteryAlertLevel("0"), null);
  assert.equal(batteryAlertLevel(null), null);
});
