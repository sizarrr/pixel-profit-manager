from fifo_inventory import FIFOInventory


def main():
    # Create a new FIFO inventory system
    inventory = FIFOInventory()
    
    print("🏪 FIFO Inventory Management System - HP EliteBook Example")
    print("="*60)
    
    # First batch: 5 HP EliteBooks bought at $100, selling at $150
    print("\n📦 Adding first batch of laptops...")
    inventory.add_batch(
        product_name="HP EliteBook",
        quantity=5,
        buy_price=100.00,
        sell_price=150.00
    )
    
    # Display current inventory
    inventory.display_inventory()
    
    # Second batch: 5 more HP EliteBooks bought at $120, selling at $170
    print("\n📦 Adding second batch of laptops...")
    inventory.add_batch(
        product_name="HP EliteBook",
        quantity=5,
        buy_price=120.00,
        sell_price=170.00
    )
    
    # Display updated inventory
    inventory.display_inventory()
    
    # Now let's sell some laptops
    print("\n💰 Customer wants to buy 3 HP EliteBooks...")
    inventory.sell_items("HP EliteBook", 3)
    
    # Check inventory after first sale
    inventory.display_inventory()
    
    # Sell more laptops
    print("\n💰 Another customer wants to buy 4 HP EliteBooks...")
    inventory.sell_items("HP EliteBook", 4)
    
    # Check inventory after second sale
    inventory.display_inventory()
    
    # Try to sell more to show FIFO in action
    print("\n💰 Big order: customer wants 3 more HP EliteBooks...")
    inventory.sell_items("HP EliteBook", 3)
    
    # Final inventory check
    inventory.display_inventory()
    
    # Show sales summary
    print("\n📊 SALES SUMMARY")
    print("="*60)
    summary = inventory.get_sales_summary()
    print(f"Total Items Sold: {summary['total_items_sold']}")
    print(f"Total Revenue: ${summary['total_revenue']:,.2f}")
    print(f"Total Cost: ${summary['total_cost']:,.2f}")
    print(f"Total Profit: ${summary['total_profit']:,.2f}")
    print(f"Profit Margin: {summary['profit_margin']:.1f}%")
    
    # Show detailed inventory status
    print("\n📋 DETAILED INVENTORY STATUS")
    print("="*60)
    status = inventory.get_inventory_status()
    for product, details in status['products'].items():
        print(f"\n{product}:")
        print(f"  Total Quantity: {details['total_quantity']}")
        print(f"  Total Buy Value: ${details['total_buy_value']:,.2f}")
        print(f"  Potential Revenue: ${details['potential_revenue']:,.2f}")
        print(f"  Batches:")
        for batch in details['batches']:
            print(f"    - {batch['batch_id']}: {batch['quantity']} units @ "
                  f"${batch['buy_price']:.2f} -> ${batch['sell_price']:.2f}")


if __name__ == "__main__":
    main()