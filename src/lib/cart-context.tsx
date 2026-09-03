"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { type Product, getApprovedProducts, saveBasket, getSavedBasketByEmail, getActiveDeliveryDays, getOrderedQuantities, getOrderedSinceCount, remainingStockFor } from "@/lib/data";
import { gaEvent } from "@/lib/ga";

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
  // Units still available this delivery week, or null if the product's stock
  // isn't tracked (the default). 0 = sold out for this week. Counted from paid
  // orders only - items in other people's baskets don't reserve anything.
  remainingStock: (productId: string) => number | null;
  topUpOrder: TopUpOrder | null;
  setTopUpOrder: (order: TopUpOrder | null) => void;
  clearTopUpOrder: () => void;
}

// GA4 add_to_cart event helper
function fireAddToCartEvent(product: Product, quantity: number) {
  gaEvent("add_to_cart", {
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

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useUser();
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // productId -> units already ordered for the next delivery day
  const [orderedQty, setOrderedQty] = useState<Record<string, number>>({});
  // Overall-stock suppliers: ordered since each product's shelf count.
  const [orderedSinceCount, setOrderedSinceCount] = useState<Record<string, number>>({});
  const [topUpOrder, setTopUpOrder] = useState<TopUpOrder | null>(null);
  const initialized = useRef(false);
  // Server-sync bookkeeping. For signed-in users, the server is the single source
  // of truth. restoredEmail tracks which email's basket we've already loaded this
  // session to avoid re-fetching on every render.
  const [restoredEmail, setRestoredEmail] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once the user has ACTIVELY added to their basket this session (as a
  // guest or signed in). This separates FRESH items the user is curating from a
  // STALE localStorage cache that was merely auto-loaded on page open. On
  // sign-in we only upload local items to an empty server if they're fresh - so
  // a basket deleted on another device can't resurrect from a stale cache (the
  // "it keeps coming back" bug), while genuinely-added items are never lost.
  const userAddedThisSession = useRef(false);

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

  // Load what's already been ordered for the next delivery day (weekly stock)
  // and since each product's shelf count (overall stock), so tracked products
  // can show "sold out" / "only N left". If no delivery day is open yet,
  // nothing is ordered against the next one - weekly counts stay empty and the
  // full weekly_stock is available.
  useEffect(() => {
    (async () => {
      try {
        const [days, since] = await Promise.all([getActiveDeliveryDays(), getOrderedSinceCount()]);
        setOrderedSinceCount(since);
        if (days.length > 0) {
          setOrderedQty(await getOrderedQuantities(days[0].deliveryDate));
        }
      } catch (e) {
        console.error("Failed to load ordered quantities:", e);
      }
    })();
  }, []);

  const remainingStock = useCallback(
    (productId: string): number | null => {
      const p = products.find((x) => x.id === productId);
      if (!p) return null;
      return remainingStockFor(p.supplierStockMode, p.weeklyStock, orderedQty[productId], orderedSinceCount[productId]);
    },
    [products, orderedQty, orderedSinceCount]
  );

  const clearTopUpOrder = useCallback(() => setTopUpOrder(null), []);

  const addItem = useCallback((productId: string, product?: Product) => {
    userAddedThisSession.current = true;
    // Fire GA4 add_to_cart event
    const prod = product || products.find((p) => p.id === productId);
    if (prod) {
      fireAddToCartEvent(prod, 1);
    }

    const remaining = remainingStock(productId);
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      // Never let the basket exceed what's left this week (checkout re-checks
      // server-side; this just stops the obvious case early)
      if (remaining != null && (existing?.quantity ?? 0) >= remaining) return prev;
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  }, [products, remainingStock]);

  const addItems = useCallback((newItems: Array<{ productId: string; quantity: number }>) => {
    userAddedThisSession.current = true;
    setItems((prev) => {
      const updated = [...prev];
      for (const newItem of newItems) {
        const remaining = remainingStock(newItem.productId);
        const existing = updated.find((i) => i.productId === newItem.productId);
        const current = existing?.quantity ?? 0;
        const allowed = remaining == null ? newItem.quantity : Math.max(0, Math.min(newItem.quantity, remaining - current));
        if (allowed === 0) continue;
        if (existing) {
          existing.quantity += allowed;
        } else {
          updated.push({ productId: newItem.productId, quantity: allowed });
        }
      }
      return updated;
    });
  }, [remainingStock]);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number, product?: Product) => {
    // Fire GA4 add_to_cart event when increasing quantity
    if (delta > 0) {
      userAddedThisSession.current = true;
      const prod = product || products.find((p) => p.id === productId);
      if (prod) {
        fireAddToCartEvent(prod, delta);
      }
    }

    const remaining = remainingStock(productId);
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          let quantity = Math.max(0, i.quantity + delta);
          // Cap increases at what's left this week (never force-shrink an
          // existing basket - the checkout gate handles that with a message)
          if (delta > 0 && remaining != null && quantity > remaining) {
            quantity = Math.max(i.quantity, remaining);
          }
          return { ...i, quantity };
        })
        .filter((i) => i.quantity > 0)
    );
  }, [products, remainingStock]);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  const totalPrice = items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    return sum + (product ? product.price * i.quantity : 0);
  }, 0);

  // Server-first basket: when a customer signs in, the server becomes the single
  // source of truth. If they had guest items in localStorage, upload them first,
  // then replace local state with whatever the server holds. This ensures:
  // - Deletes from admin or other browsers stick (no local copy to resurrect)
  // - Cross-device sync works (everyone reads from the same server row)
  // - Guest → sign-in preserves their shopping (uploaded once, then server rules)
  useEffect(() => {
    if (!isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    if (!email || restoredEmail === email) return;

    let cancelled = false;

    (async () => {
      try {
        const localItems = items;

        // Fetch the server basket - it's the source of truth for signed-in users.
        const saved = await getSavedBasketByEmail(email);
        if (cancelled) return;

        if (saved && saved.items.length > 0) {
          // Server has a basket - adopt it.
          setItems(saved.items);
        } else if (localItems.length > 0 && userAddedThisSession.current) {
          // Server is empty but the user actively added these items this session
          // (as a guest, or just now while signed in) - preserve them by
          // uploading. They become the server state.
          const localTotal = localItems.reduce((sum, i) => {
            const product = products.find((p) => p.id === i.productId);
            return sum + (product ? product.price * i.quantity : 0);
          }, 0);
          await saveBasket(user.id, email, localItems, localTotal);
          if (cancelled) return;
        } else {
          // Server is empty/deleted and the user hasn't actively added anything
          // this session - the local items are just a stale localStorage cache.
          // Clear to match the server so a basket deleted elsewhere can't
          // resurrect. (Freshly-added items hit the branch above, never here.)
          setItems([]);
        }
        setRestoredEmail(email);
      } catch (e) {
        console.error("Failed to sync basket with server:", e);
        if (!cancelled) setRestoredEmail(email); // Mark as restored to avoid retry loop
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, user, restoredEmail, items, products]);

  // Persist the basket to the server on every change (debounced), once signed in
  // and this email's restore has completed. Server is authoritative, so all changes
  // (including removals and clearing) write through immediately.
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
        remainingStock,
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
