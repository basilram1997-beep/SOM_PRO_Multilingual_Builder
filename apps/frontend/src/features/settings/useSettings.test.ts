import test from "node:test";
import assert from "node:assert/strict";
import { upsertPeriod } from "./settingsState.ts";

test("settings period state stays sorted and updates a single existing row", () => {
  const initial = [
    { period: 3, label: "Ø§Ù„Ø­ØµØ© 3", startTime: "10:00", endTime: "10:45", isActive: true },
    { period: 1, label: "Ø§Ù„Ø­ØµØ© 1", startTime: "08:00", endTime: "08:45", isActive: true }
  ];

  const afterInsert = upsertPeriod(initial, 2, {
    label: "Ø§Ù„Ø­ØµØ© 2",
    startTime: "09:00",
    endTime: "09:45"
  });

  assert.deepEqual(
    afterInsert.map((period) => period.period),
    [1, 2, 3]
  );
  assert.equal(afterInsert[1]?.label, "Ø§Ù„Ø­ØµØ© 2");
  assert.equal(afterInsert[1]?.isActive, true);

  const afterUpdate = upsertPeriod(afterInsert, 3, {
    label: "Ø§Ù„Ø­ØµØ© 3 Ù…Ø­Ø¯Ø«Ø©",
    isActive: false
  });

  assert.deepEqual(
    afterUpdate.map((period) => period.period),
    [1, 2, 3]
  );
  assert.equal(afterUpdate.filter((period) => period.period === 3).length, 1);
  assert.equal(afterUpdate[2]?.label, "Ø§Ù„Ø­ØµØ© 3 Ù…Ø­Ø¯Ø«Ø©");
  assert.equal(afterUpdate[2]?.isActive, false);
});
