import { render, screen } from "@testing-library/react";
import App from "./App";

// PUBLIC_INTERFACE
test("renders brand in header", () => {
  render(<App />);
  const brand = screen.getByText(/fruit slice/i);
  expect(brand).toBeInTheDocument();
});
