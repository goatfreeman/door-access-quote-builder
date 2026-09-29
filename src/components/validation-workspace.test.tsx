import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ValidationWorkspace } from "./validation-workspace";

describe("ValidationWorkspace", () => {
  it("shows the confidentiality boundary and independent agent stages", () => {
    const html = renderToStaticMarkup(<ValidationWorkspace />);

    expect(html).toContain(
      "Do not enter client names, project locations, device locations, network details, credentials, prices, or controlled drawings. Enter product identifiers and a compatibility question only.",
    );
    expect(html).toContain("Researcher");
    expect(html).toContain("Verifier");
    expect(html).toContain("Tester");
    expect(html).toContain("qualified Caltron reviewer");
  });
});