import { mount } from "cypress/react";
import "../../src/styles/global.css";
import "../../src/styles/pages.css";

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add("mount", (component, options = {}) => mount(component, options));

export {};
