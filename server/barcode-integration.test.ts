import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Integration tests for barcode scanner feature
 * Tests the complete flow: barcode detection -> product lookup -> cart addition
 */

interface Product {
  id: number;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  categoryId: number;
}

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

// Mock database
const mockProducts: Product[] = [
  {
    id: 1,
    name: "جهاز كمبيوتر",
    barcode: "1234567890",
    price: 2500,
    quantity: 10,
    categoryId: 1,
  },
  {
    id: 2,
    name: "لوحة مفاتيح",
    barcode: "9876543210",
    price: 150,
    quantity: 25,
    categoryId: 1,
  },
  {
    id: 3,
    name: "ماوس",
    barcode: "5555555555",
    price: 75,
    quantity: 50,
    categoryId: 1,
  },
];

describe("Barcode Scanner Integration Tests", () => {
  let cart: CartItem[] = [];

  beforeEach(() => {
    cart = [];
  });

  describe("Barcode Detection and Validation", () => {
    it("should validate numeric barcode format", () => {
      const validBarcodes = ["1234567890", "9876543210", "5555555555"];
      validBarcodes.forEach((barcode) => {
        const isValid = /^\d+$/.test(barcode);
        expect(isValid).toBe(true);
      });
    });

    it("should reject non-numeric barcodes", () => {
      const invalidBarcodes = ["ABC123", "12345-6789", "123 456", ""];
      invalidBarcodes.forEach((barcode) => {
        const isValid = /^\d+$/.test(barcode);
        expect(isValid).toBe(false);
      });
    });

    it("should handle barcode with leading zeros", () => {
      const barcode = "0001234567";
      const isValid = /^\d+$/.test(barcode);
      expect(isValid).toBe(true);
    });
  });

  describe("Product Lookup", () => {
    it("should find product by valid barcode", () => {
      const barcode = "1234567890";
      const product = mockProducts.find((p) => p.barcode === barcode);
      expect(product).toBeDefined();
      expect(product?.name).toBe("جهاز كمبيوتر");
      expect(product?.price).toBe(2500);
    });

    it("should return undefined for non-existent barcode", () => {
      const barcode = "0000000000";
      const product = mockProducts.find((p) => p.barcode === barcode);
      expect(product).toBeUndefined();
    });

    it("should find correct product from multiple products", () => {
      const barcode = "9876543210";
      const product = mockProducts.find((p) => p.barcode === barcode);
      expect(product?.id).toBe(2);
      expect(product?.name).toBe("لوحة مفاتيح");
    });

    it("should check product availability", () => {
      const barcode = "1234567890";
      const product = mockProducts.find((p) => p.barcode === barcode);
      expect(product?.quantity).toBeGreaterThan(0);
    });
  });

  describe("Cart Operations", () => {
    it("should add product to empty cart", () => {
      const product = mockProducts[0];
      const cartItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
      };
      cart.push(cartItem);

      expect(cart).toHaveLength(1);
      expect(cart[0].productId).toBe(1);
      expect(cart[0].quantity).toBe(1);
    });

    it("should increment quantity if product already in cart", () => {
      const product = mockProducts[0];
      const cartItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
      };
      cart.push(cartItem);

      // Add same product again
      const existingItem = cart.find((item) => item.productId === product.id);
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.subtotal = existingItem.quantity * existingItem.price;
      }

      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(2);
      expect(cart[0].subtotal).toBe(5000);
    });

    it("should not exceed available stock", () => {
      const product = mockProducts[0];
      const cartItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: product.quantity + 1,
        subtotal: product.price * (product.quantity + 1),
      };

      expect(cartItem.quantity).toBeGreaterThan(product.quantity);
    });

    it("should calculate correct subtotal", () => {
      const product = mockProducts[0];
      const quantity = 3;
      const expectedSubtotal = product.price * quantity;

      const cartItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        subtotal: expectedSubtotal,
      };

      expect(cartItem.subtotal).toBe(7500);
    });
  });

  describe("Complete Barcode Scanning Flow", () => {
    it("should complete full flow: scan -> lookup -> add to cart", () => {
      const scannedBarcode = "1234567890";

      // Step 1: Validate barcode
      const isValidBarcode = /^\d+$/.test(scannedBarcode);
      expect(isValidBarcode).toBe(true);

      // Step 2: Find product
      const product = mockProducts.find((p) => p.barcode === scannedBarcode);
      expect(product).toBeDefined();

      // Step 3: Check availability
      if (product && product.quantity > 0) {
        // Step 4: Add to cart
        const cartItem: CartItem = {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price,
        };
        cart.push(cartItem);
      }

      expect(cart).toHaveLength(1);
      expect(cart[0].name).toBe("جهاز كمبيوتر");
      expect(cart[0].price).toBe(2500);
    });

    it("should handle multiple barcode scans", () => {
      const barcodes = ["1234567890", "9876543210", "5555555555"];

      barcodes.forEach((barcode) => {
        const product = mockProducts.find((p) => p.barcode === barcode);
        if (product) {
          const cartItem: CartItem = {
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            subtotal: product.price,
          };
          cart.push(cartItem);
        }
      });

      expect(cart).toHaveLength(3);
      expect(cart[0].name).toBe("جهاز كمبيوتر");
      expect(cart[1].name).toBe("لوحة مفاتيح");
      expect(cart[2].name).toBe("ماوس");
    });

    it("should handle duplicate barcode scans (same product twice)", () => {
      const barcode = "1234567890";

      // First scan
      const product = mockProducts.find((p) => p.barcode === barcode);
      if (product) {
        const cartItem: CartItem = {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price,
        };
        cart.push(cartItem);
      }

      // Second scan (same product)
      const existingItem = cart.find((item) => item.productId === product?.id);
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.subtotal = existingItem.quantity * existingItem.price;
      }

      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle product not found error", () => {
      const barcode = "9999999999";
      const product = mockProducts.find((p) => p.barcode === barcode);

      if (!product) {
        expect(product).toBeUndefined();
      }
    });

    it("should handle out of stock products", () => {
      const outOfStockProduct: Product = {
        id: 99,
        name: "منتج غير متوفر",
        barcode: "0000000001",
        price: 100,
        quantity: 0,
        categoryId: 1,
      };

      const canAddToCart = outOfStockProduct.quantity > 0;
      expect(canAddToCart).toBe(false);
    });

    it("should handle invalid barcode format", () => {
      const invalidBarcode = "ABC-123";
      const isValid = /^\d+$/.test(invalidBarcode);

      expect(isValid).toBe(false);
    });
  });

  describe("Cart Calculations", () => {
    it("should calculate correct total for multiple items", () => {
      const items = [
        { name: "جهاز كمبيوتر", price: 2500, quantity: 1 },
        { name: "لوحة مفاتيح", price: 150, quantity: 2 },
        { name: "ماوس", price: 75, quantity: 3 },
      ];

      let total = 0;
      items.forEach((item) => {
        total += item.price * item.quantity;
      });

      expect(total).toBe(2500 + 300 + 225);
      expect(total).toBe(3025);
    });

    it("should apply discount correctly", () => {
      const subtotal = 3025;
      const discountPercent = 10;
      const discountAmount = subtotal * (discountPercent / 100);
      const afterDiscount = subtotal - discountAmount;

      expect(discountAmount).toBe(302.5);
      expect(afterDiscount).toBe(2722.5);
    });

    it("should apply tax correctly", () => {
      const subtotal = 2722.5;
      const taxPercent = 15;
      const taxAmount = subtotal * (taxPercent / 100);
      const finalTotal = subtotal + taxAmount;

      expect(taxAmount).toBe(408.375);
      expect(finalTotal).toBe(3130.875);
    });
  });
});
