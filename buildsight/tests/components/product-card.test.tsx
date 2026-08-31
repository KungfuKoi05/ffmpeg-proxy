/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/components/catalog/product-card";
import { serializedProduct } from "../serialized-fixtures";

describe("ProductCard", () => {
  it("shows the product, manufacturer and part number", () => {
    render(<ProductCard product={serializedProduct()} />);
    expect(screen.getByText("Product barrel")).toBeInTheDocument();
    expect(screen.getByText("Test Manufacturer")).toBeInTheDocument();
    expect(screen.getByText("PN-barrel")).toBeInTheDocument();
  });

  it("renders published measurements in imperial units", () => {
    render(<ProductCard product={serializedProduct({ lengthMm: 406.4, weightGrams: 850 })} />);
    expect(screen.getByText("16 in")).toBeInTheDocument();
    expect(screen.getByText("1 lb 14 oz")).toBeInTheDocument();
  });

  it("shows a dash rather than a zero for unpublished values", () => {
    render(
      <ProductCard
        product={serializedProduct({ lengthMm: null, weightGrams: null, msrpCents: null, currentPriceCents: null })}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("0 in")).not.toBeInTheDocument();
  });

  it("labels demo records", () => {
    render(<ProductCard product={serializedProduct({ isDemo: true })} />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  it("shows the verification level", () => {
    render(<ProductCard product={serializedProduct({ verificationStatus: "USER_SUBMITTED" })} />);
    expect(screen.getByText("User submitted")).toBeInTheDocument();
  });
});
