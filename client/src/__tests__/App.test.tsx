import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

vi.mock("../pages/ListPage", () => ({ default: () => <div>ListPage</div> }));
vi.mock("../pages/DetailPage", () => ({ default: () => <div>DetailPage</div> }));
vi.mock("../pages/CreatePage", () => ({ default: () => <div>CreatePage</div> }));
vi.mock("../pages/ApplicationPage", () => ({ default: () => <div>ApplicationPage</div> }));
vi.mock("../pages/AdminPage", () => ({ default: () => <div>AdminPage</div> }));
vi.mock("../pages/CommitteePage", () => ({ default: () => <div>CommitteePage</div> }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("App routing", () => {
  test("renders the list page at /", () => {
    renderAt("/");
    expect(screen.getByText("ListPage")).toBeInTheDocument();
  });

  test("renders the detail page at /protocols/:id", () => {
    renderAt("/protocols/IACUC-2026-0142");
    expect(screen.getByText("DetailPage")).toBeInTheDocument();
  });

  test("renders the create page at /protocols/new", () => {
    renderAt("/protocols/new");
    expect(screen.getByText("CreatePage")).toBeInTheDocument();
  });

  test("renders the application page at /protocols/:id/application", () => {
    renderAt("/protocols/IACUC-2026-0142/application");
    expect(screen.getByText("ApplicationPage")).toBeInTheDocument();
  });

  test("renders the committee page at /committee", () => {
    renderAt("/committee");
    expect(screen.getByText("CommitteePage")).toBeInTheDocument();
  });

  test("renders the admin page at /admin", () => {
    renderAt("/admin");
    expect(screen.getByText("AdminPage")).toBeInTheDocument();
  });

  test("renders a not-found message for unknown paths", () => {
    renderAt("/definitely/not/a/route");
    expect(screen.getByText("Page not found.")).toBeInTheDocument();
  });
});
