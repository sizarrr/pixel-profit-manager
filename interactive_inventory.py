from fifo_inventory import FIFOInventory
import json


class InteractiveInventoryManager:
    """Interactive FIFO Inventory Management System"""
    
    def __init__(self):
        self.inventory = FIFOInventory()
        
    def run(self):
        """Run the interactive inventory manager"""
        print("🏪 FIFO Inventory Management System")
        print("="*60)
        print("Commands:")
        print("  1. Add new batch")
        print("  2. Sell items")
        print("  3. View inventory")
        print("  4. View sales summary")
        print("  5. Save inventory to file")
        print("  6. Load inventory from file")
        print("  7. Quick demo (HP EliteBook scenario)")
        print("  0. Exit")
        print("="*60)
        
        while True:
            try:
                choice = input("\nEnter command (0-7): ").strip()
                
                if choice == "0":
                    print("👋 Goodbye!")
                    break
                elif choice == "1":
                    self.add_batch()
                elif choice == "2":
                    self.sell_items()
                elif choice == "3":
                    self.view_inventory()
                elif choice == "4":
                    self.view_sales_summary()
                elif choice == "5":
                    self.save_inventory()
                elif choice == "6":
                    self.load_inventory()
                elif choice == "7":
                    self.run_demo()
                else:
                    print("❌ Invalid choice. Please try again.")
                    
            except KeyboardInterrupt:
                print("\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
    
    def add_batch(self):
        """Add a new batch interactively"""
        print("\n📦 ADD NEW BATCH")
        product_name = input("Product name: ").strip()
        if not product_name:
            print("❌ Product name cannot be empty")
            return
            
        try:
            quantity = int(input("Quantity: "))
            buy_price = float(input("Buy price per unit: $"))
            sell_price = float(input("Sell price per unit: $"))
            
            if quantity <= 0 or buy_price <= 0 or sell_price <= 0:
                print("❌ All values must be positive")
                return
                
            self.inventory.add_batch(product_name, quantity, buy_price, sell_price)
            
        except ValueError:
            print("❌ Invalid input. Please enter valid numbers.")
    
    def sell_items(self):
        """Sell items interactively"""
        print("\n💰 SELL ITEMS")
        product_name = input("Product name: ").strip()
        if not product_name:
            print("❌ Product name cannot be empty")
            return
            
        try:
            quantity = int(input("Quantity to sell: "))
            if quantity <= 0:
                print("❌ Quantity must be positive")
                return
                
            sales = self.inventory.sell_items(product_name, quantity)
            
            if sales:
                total_profit = sum(sale['total_profit'] for sale in sales)
                print(f"\n✅ Sale completed! Total profit: ${total_profit:.2f}")
            else:
                print("\n❌ No items sold. Check product name and stock.")
                
        except ValueError:
            print("❌ Invalid input. Please enter a valid number.")
    
    def view_inventory(self):
        """Display current inventory"""
        self.inventory.display_inventory()
        
        # Show additional details
        status = self.inventory.get_inventory_status()
        if status['products']:
            print("\n📋 INVENTORY DETAILS BY PRODUCT")
            print("-"*60)
            for product, details in status['products'].items():
                print(f"\n{product}:")
                print(f"  Total Units: {details['total_quantity']}")
                print(f"  Investment: ${details['total_buy_value']:,.2f}")
                print(f"  Potential Revenue: ${details['potential_revenue']:,.2f}")
                print(f"  Expected Profit: ${details['potential_revenue'] - details['total_buy_value']:,.2f}")
    
    def view_sales_summary(self):
        """Display sales summary"""
        summary = self.inventory.get_sales_summary()
        
        print("\n📊 SALES SUMMARY")
        print("="*60)
        print(f"Total Sales: {summary['sales_count']}")
        print(f"Items Sold: {summary['total_items_sold']}")
        print(f"Total Revenue: ${summary['total_revenue']:,.2f}")
        print(f"Total Cost: ${summary['total_cost']:,.2f}")
        print(f"Total Profit: ${summary['total_profit']:,.2f}")
        print(f"Profit Margin: {summary['profit_margin']:.1f}%")
        print("="*60)
    
    def save_inventory(self):
        """Save inventory to a JSON file"""
        filename = input("Enter filename (default: inventory.json): ").strip()
        if not filename:
            filename = "inventory.json"
        
        if not filename.endswith('.json'):
            filename += '.json'
        
        try:
            # Prepare data for serialization
            data = {
                'inventory': [
                    {
                        'product_name': batch.product_name,
                        'quantity': batch.quantity,
                        'buy_price': batch.buy_price,
                        'sell_price': batch.sell_price,
                        'batch_id': batch.batch_id,
                        'purchase_date': batch.purchase_date.isoformat()
                    }
                    for batch in self.inventory.inventory
                ],
                'sales_history': self.inventory.sales_history,
                'batch_counter': self.inventory.batch_counter
            }
            
            with open(filename, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            
            print(f"✅ Inventory saved to {filename}")
            
        except Exception as e:
            print(f"❌ Error saving inventory: {e}")
    
    def load_inventory(self):
        """Load inventory from a JSON file"""
        filename = input("Enter filename (default: inventory.json): ").strip()
        if not filename:
            filename = "inventory.json"
        
        if not filename.endswith('.json'):
            filename += '.json'
        
        try:
            with open(filename, 'r') as f:
                data = json.load(f)
            
            # Clear current inventory
            self.inventory = FIFOInventory()
            
            # Restore batch counter
            self.inventory.batch_counter = data.get('batch_counter', 0)
            
            # Load inventory batches
            for batch_data in data['inventory']:
                from datetime import datetime
                from fifo_inventory import InventoryBatch
                
                batch = InventoryBatch(
                    product_name=batch_data['product_name'],
                    quantity=batch_data['quantity'],
                    buy_price=batch_data['buy_price'],
                    sell_price=batch_data['sell_price'],
                    batch_id=batch_data['batch_id'],
                    purchase_date=datetime.fromisoformat(batch_data['purchase_date'])
                )
                self.inventory.inventory.append(batch)
            
            # Load sales history
            self.inventory.sales_history = data.get('sales_history', [])
            
            print(f"✅ Inventory loaded from {filename}")
            print(f"   Loaded {len(self.inventory.inventory)} batches")
            print(f"   Loaded {len(self.inventory.sales_history)} sales records")
            
        except FileNotFoundError:
            print(f"❌ File {filename} not found")
        except Exception as e:
            print(f"❌ Error loading inventory: {e}")
    
    def run_demo(self):
        """Run the HP EliteBook demo scenario"""
        print("\n🎬 Running HP EliteBook Demo...")
        print("="*60)
        
        # Clear inventory for demo
        self.inventory = FIFOInventory()
        
        # First batch
        print("Adding first batch: 5 HP EliteBooks @ $100 -> $150")
        self.inventory.add_batch("HP EliteBook", 5, 100, 150)
        
        # Second batch
        print("\nAdding second batch: 5 HP EliteBooks @ $120 -> $170")
        self.inventory.add_batch("HP EliteBook", 5, 120, 170)
        
        # Show inventory
        self.inventory.display_inventory()
        
        # Demonstrate FIFO selling
        print("\n🛒 Selling 7 HP EliteBooks (will use FIFO)...")
        self.inventory.sell_items("HP EliteBook", 7)
        
        print("\nNotice how:")
        print("- First 5 laptops sold were from batch 1 ($100 cost, $150 sell)")
        print("- Next 2 laptops sold were from batch 2 ($120 cost, $170 sell)")
        print("- This follows FIFO principle: oldest inventory sold first")
        
        # Show remaining inventory
        self.inventory.display_inventory()
        
        # Show profit calculation
        summary = self.inventory.get_sales_summary()
        print(f"\nProfit from sales: ${summary['total_profit']:.2f}")
        print(f"  = (5 × $150 + 2 × $170) - (5 × $100 + 2 × $120)")
        print(f"  = $1,090 - $740 = $350")


def main():
    manager = InteractiveInventoryManager()
    manager.run()


if __name__ == "__main__":
    main()