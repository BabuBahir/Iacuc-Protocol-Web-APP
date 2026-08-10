import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import AccessBanner, { OFFICE_ROLES } from "../AccessBanner";
import { setActingAs } from "../../identity";

function renderBanner(props: { mode?: "office" | "committee"; committeePersonnelIds?: number[] } = {}) {
  return render(
    <AccessBanner mode={props.mode ?? "office"} committeePersonnelIds={props.committeePersonnelIds} />
  );
}

describe("AccessBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("office mode warns when no one is signed in", () => {
    renderBanner({ mode: "office" });
    expect(screen.getByTestId("access-banner")).toBeInTheDocument();
    expect(screen.getByText(/IACUC office staff only/)).toBeInTheDocument();
    expect(screen.getByText(/not signed in as anyone/)).toBeInTheDocument();
  });

  test("office mode warns for a non-office persona", () => {
    setActingAs({ personnelId: 9, name: "Dr. Bench Scientist", roleName: "Principal Investigator" });
    renderBanner({ mode: "office" });
    expect(screen.getByTestId("access-banner")).toBeInTheDocument();
    expect(screen.getByText(/Dr. Bench Scientist \(Principal Investigator\)/)).toBeInTheDocument();
  });

  test("office mode is hidden for an office persona", () => {
    setActingAs({ personnelId: 3, name: "Dr. Coordinator", roleName: OFFICE_ROLES[0] });
    renderBanner({ mode: "office" });
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });

  test("committee mode warns for a non-committee persona", () => {
    setActingAs({ personnelId: 9, name: "Dr. Bench Scientist", roleName: "Principal Investigator" });
    renderBanner({ mode: "committee", committeePersonnelIds: [1, 2] });
    expect(screen.getByTestId("access-banner")).toBeInTheDocument();
    expect(screen.getByText(/Committee members only/)).toBeInTheDocument();
  });

  test("committee mode is hidden for a committee-eligible persona", () => {
    setActingAs({ personnelId: 2, name: "Dr. Harold Kim", roleName: "IACUC Chair" });
    renderBanner({ mode: "committee", committeePersonnelIds: [1, 2] });
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });

  test("committee mode is hidden for office staff even when not on the voter list", () => {
    setActingAs({ personnelId: 99, name: "Dr. Coordinator", roleName: "IACUC Coordinator" });
    renderBanner({ mode: "committee", committeePersonnelIds: [1, 2] });
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();
  });

  test("reacts to identity changes while mounted", () => {
    renderBanner({ mode: "office" });
    expect(screen.getByTestId("access-banner")).toBeInTheDocument();

    act(() => {
      setActingAs({ personnelId: 3, name: "Dr. Coordinator", roleName: "IACUC Coordinator" });
    });
    expect(screen.queryByTestId("access-banner")).not.toBeInTheDocument();

    act(() => {
      setActingAs(null);
    });
    expect(screen.getByTestId("access-banner")).toBeInTheDocument();
  });
});
