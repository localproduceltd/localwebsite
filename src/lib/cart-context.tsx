"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { type Product, getApprovedProducts, saveBasket, getSavedBasketByEmail } from "@/lib/data";

const CART_STORAGE_KEY = "local-produce-cart";
const TOPUP_STORAGE_KEY = "local-produce-topup";

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface TopUpOrder {
  orderId: string;
  orderNumber: number;
  deliveryDay: string;
  customerEmail: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (productId: string, product?: Product) => void;
  addItems: (items: Array<{ productId: string; quantity: number }>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, delta: number, product?: Product) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getProduct: (productId: string) => Product | undefined;
  products: Product[];
  topUpOrder: TopUpOrder | null;
  setTopUpOrder: (order: TopUpOrder | null) => void;
  clearTopUpOrder: () => void;
}

// GA4 add_to_cart event helper
function fireAddToCartEvent(product: Product, quantity: number) {
  if (typeof window !== "undefined" && "gtag" in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", "add_to_cart", {
      currency: "GBP",
      value: product.price * quantity,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          item_category: product.category,
          item_brand: product.supplierName,
          price: product.price,
          quantity: quantity,
        },
      ],
    });
  }
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useUser();
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [topUpOrder, setTopUpOrder] = useState<TopUpOrder | null>(null);
  const initialized = useRef(false);
  // Server-sync (cross-device saved basket) bookkeeping.
  // restoredEmail = the email whose saved basket has already been loaded into this
  // session. Set only in async callbacks so we never trigger cascading renders.
  const [restoredEmail, setRestoredEmail] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
      
      const savedTopUp = localStorage.getItem(TOPUP_STORAGE_KEY);
      if (savedTopUp) {
        const parsed = JSON.parse(savedTopUp);
        if (parsed && parsed.orderId) {
          setTopUpOrder(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage:", e);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!initialized.current) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save cart to localStorage:", e);
    }
  }, [items]);

  // Save topUpOrder to localStorage whenever it changes
  useEffect(() => {
    if (!initialized.current) return;
    try {
      if (topUpOrder) {
        localStorage.setItem(TOPUP_STORAGE_KEY, JSON.stringify(topUpOrder));
      } else {
        localStorage.removeItem(TOPUP_STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to save topUpOrder to localStorage:", e);
    }
  }, [topUpOrder]);

  useEffect(() => {
    getApprovedProducts().then(setProducts).catch(console.error);
  }, []);

  const clearTopUpOrder = useCallback(() => setTopUpOrder(null), []);

  const addItem = useCallback((productId: string, product?: Product) => {
    // Fire GA4 add_to_cart event
    const prod = product || products.find((p) => p.id === productId);
    if (prod) {
      fireAddToCartEvent(prod, 1);
    }
    
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  }, [products]);

  const addItems = useCallback((newItems: Array<{ productId: string; quantity: number }>) => {
    setItems((prev) => {
      const updated = [...prev];
      for (const newItem of newItems) {
        const existing = updated.find((i) => i.productId === newItem.productId);
        if (existing) {
          existing.quantity += newItem.quantity;
        } else {
          updated.push({ productId: newItem.productId, quantity: newItem.quantity });
        }
      }
      return updated;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number, product?: Product) => {
    // Fire GA4 add_to_cart event when increasing quantity
    if (delta > 0) {
      const prod = product || products.find((p) => p.id === productId);
      if (prod) {
        fireAddToCartEvent(prod, delta);
      }
    }
    
    setItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, [products]);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  const totalPrice = items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    return sum + (product ? product.price * i.quantity : 0);
  }, 0);

  // Cross-device saved basket: when a customer signs in, load their saved basket
  // from the server (keyed on email) and merge it with anything already in this
  // browser. Runs once per signed-in email; setRestoredEmail fires only after the
  // async load settles, so the save effect below won't run with stale items.
  useEffect(() => {
    if (!isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    if (!email || restoredEmail === email) return;

    let cancelled = false;
    getSavedBasketByEmail(email)
      .then((saved) => {
        if (cancelled || !saved || saved.items.length === 0) return;
        setItems((prev) => {
          // Server basket is the base; append any product added in this browser
          // that isn't already saved. Quantities never double up.
          const merged = [...saved.items];
          for (const local of prev) {
            if (!merged.some((m) => m.productId === local.productId)) {
              merged.push(local);
            }
          }
          return merged;
        });
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setRestoredEmail(email);
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user, restoredEmail]);

  // Persist the basket to the server on every change (debounced), once signed in
  // and this email's restore has completed. This makes removals stick and keeps the
  // admin Saved Baskets view current without the customer sitting on the cart page.
  useEffect(() => {
    if (!initialized.current || !isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    if (!email || restoredEmail !== email) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveBasket(user.id, email, items, totalPrice).catch((e) =>
        console.error("Saved basket sync failed:", e)
      );
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [items, isSignedIn, user, restoredEmail, totalPrice]);

  const getProduct = useCallback(
    (productId: string) => products.find((p) => p.id === productId),
    [products]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        addItems,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        getProduct,
        products,
        topUpOrder,
        setTopUpOrder,
        clearTopUpOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
