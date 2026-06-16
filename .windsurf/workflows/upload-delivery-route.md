---
description: Upload the weekly delivery route to the website for driver tracking
---

# Upload Delivery Route

This workflow uploads the optimized delivery route to the website so the driver can use the `/admin/driver` page to track deliveries and trigger customer emails.

## When to use

After building the Friday delivery route (run sheet, map, xlsx), also generate and upload the route JSON to the website.

## Route JSON format

Create a file called `route-YYYY-MM-DD.json` with this structure:

```json
{
  "delivery_day": "2026-06-12",
  "route": [
    {"order_number": 110, "leg": "morning", "position": 1},
    {"order_number": 123, "leg": "morning", "position": 2},
    {"order_number": 105, "leg": "morning", "position": 3},
    ...
    {"order_number": 122, "leg": "afternoon", "position": 1},
    {"order_number": 124, "leg": "afternoon", "position": 2},
    ...
  ]
}
```

**Fields:**
- `delivery_day`: The delivery date in YYYY-MM-DD format
- `route`: Array of stops in delivery order
  - `order_number`: The order number (e.g., 110)
  - `leg`: Either "morning" or "afternoon"
  - `position`: Position within that leg (1, 2, 3, ...)

## Steps

1. **Generate the route JSON** alongside the other route outputs (xlsx, html map, run sheet)

2. **Save the file** to `/Users/Josie/Documents/Claude/Projects/Local Produce Website/Weekly Operations/delivery_routes/route-YYYY-MM-DD.json`

3. **Upload to the website** by making a POST request:

```bash
curl -X POST https://localproduce.ltd/api/admin/delivery-route \
  -H "Content-Type: application/json" \
  -d @route-2026-06-12.json
```

Or if running locally:
```bash
curl -X POST http://localhost:3000/api/admin/delivery-route \
  -H "Content-Type: application/json" \
  -d @route-2026-06-12.json
```

4. **Verify** by checking the driver page at `/admin/driver`

## How the driver page works

- Driver selects the delivery day
- Taps "Start Run" → first 3 orders marked as "next hour", customers get "on our way" emails
- Driver taps "Delivered" on each stop → that order marked delivered, customer gets "delivered" email
- System automatically keeps the next 3 undelivered orders marked as "next hour"
- Progress shown at top (delivered / on way / remaining)

## Notes

- The route can be re-uploaded to update the order
- Orders not in the route JSON won't appear on the driver page
- The driver page is mobile-friendly for use in the van
