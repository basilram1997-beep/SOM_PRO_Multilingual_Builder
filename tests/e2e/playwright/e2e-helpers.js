const { generateE2ELicenseCode } = require("../../../scripts/e2e-license");

function getE2ELicenseCode() {
  return (
    process.env.SOM_E2E_LICENSE_CODE ||
    generateE2ELicenseCode({
      days: 365,
      schoolName: process.env.SOM_E2E_SCHOOL_NAME || "مدرسة تجريبية",
      institutionCode: process.env.SOM_E2E_INSTITUTION_CODE || "TRIAL-4100",
      secret: process.env.SOM_PRO_LICENSE_SECRET || "change-this-secret-before-selling"
    })
  );
}

async function clickStable(locator) {
  await locator.waitFor({ state: "visible", timeout: 10_000 });
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) return;
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
  });
}

async function openSidebarSection(page, groupSelector, itemSelector) {
  await clickStable(page.locator(groupSelector));
  await clickStable(page.locator(itemSelector));
}

module.exports = {
  getE2ELicenseCode,
  clickStable,
  openSidebarSection
};
