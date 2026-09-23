import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import QuickParkingReportSheet from "./QuickParkingReportSheet";
import { defaultParking } from "./testFixtures";

let host: HTMLDivElement;
let root: Root;
const onClose = vi.fn();
const onSubmit = vi.fn(async () => undefined);

beforeEach(async () => {
  onClose.mockClear();
  onSubmit.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <QuickParkingReportSheet
        parking={defaultParking}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("offers parking-specific community report categories", () => {
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  expect(host.textContent).toContain("Ka vende të lira");
  expect(host.textContent).toContain("Parking publik");
  expect(host.textContent).toContain("Parking falas");
  expect(host.textContent).toContain("Çmim i gabuar");
  expect(host.textContent).toContain("Hyrje e bllokuar");
});

it("submits the chosen category with an optional note", async () => {
  const freeButton = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Parking falas"),
  ) as HTMLButtonElement;
  await act(async () => freeButton.click());

  const note = host.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(note, "Vetëm për klientë");
    note.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const submit = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Dërgo raportin",
  ) as HTMLButtonElement;
  await act(async () => submit.click());

  expect(onSubmit).toHaveBeenCalledWith({
    payment: "free",
    description: "Ky parking është pa pagesë. Shënim: Vetëm për klientë",
  });
  expect(host.textContent).toContain("Raporti u dërgua");
});

it("closes from Escape", async () => {
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  expect(onClose).toHaveBeenCalledOnce();
});

it("routes guests to login before sending a report", async () => {
  const onRequireLogin = vi.fn();
  await act(async () => {
    root.render(
      <QuickParkingReportSheet
        parking={defaultParking}
        canReport={false}
        onClose={onClose}
        onRequireLogin={onRequireLogin}
        onSubmit={onSubmit}
      />,
    );
  });
  const publicButton = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Parking publik"),
  ) as HTMLButtonElement;
  await act(async () => publicButton.click());
  const login = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Kyçu për të raportuar",
  ) as HTMLButtonElement;
  await act(async () => login.click());
  expect(onRequireLogin).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
});
