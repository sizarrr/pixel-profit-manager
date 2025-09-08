from collections import deque
from dataclasses import dataclass
from typing import List, Tuple, Optional
from datetime import datetime


@dataclass
class InventoryBatch:
    """Represents a batch of items with specific buy and sell prices"""
    product_name: str
    quantity: int
    buy_price: float
    sell_price: float
    batch_id: str
    purchase_date: datetime
    
    def __repr__(self):
        return (f"Batch({self.batch_id}): {self.quantity} x {self.product_name} "
                f"@ ${self.buy_price:.2f} -> ${self.sell_price:.2f}")


class FIFOInventory:
    """FIFO Inventory Management System"""
    
    def __init__(self):
        # Using deque for efficient FIFO operations
        self.inventory = deque()
        self.sales_history = []
        self.batch_counter = 0
        
    def add_batch(self, product_name: str, quantity: int, 
                  buy_price: float, sell_price: float) -> str:
        """Add a new batch of products to inventory"""
        self.batch_counter += 1
        batch_id = f"BATCH-{self.batch_counter:04d}"
        
        batch = InventoryBatch(
            product_name=product_name,
            quantity=quantity,
            buy_price=buy_price,
            sell_price=sell_price,
            batch_id=batch_id,
            purchase_date=datetime.now()
        )
        
        self.inventory.append(batch)
        print(f"✓ Added {batch}")
        return batch_id
    
    def sell_items(self, product_name: str, quantity_to_sell: int) -> List[dict]:
        """Sell items using FIFO principle"""
        sales = []
        remaining_to_sell = quantity_to_sell
        
        # Create a temporary list to hold batches we need to put back
        temp_batches = []
        
        while self.inventory and remaining_to_sell > 0:
            batch = self.inventory.popleft()
            
            # If this batch is not the product we want, save it for later
            if batch.product_name != product_name:
                temp_batches.append(batch)
                continue
            
            # Calculate how many we can sell from this batch
            sold_from_batch = min(batch.quantity, remaining_to_sell)
            
            # Record the sale
            sale_record = {
                'batch_id': batch.batch_id,
                'product_name': batch.product_name,
                'quantity_sold': sold_from_batch,
                'buy_price': batch.buy_price,
                'sell_price': batch.sell_price,
                'profit_per_unit': batch.sell_price - batch.buy_price,
                'total_profit': sold_from_batch * (batch.sell_price - batch.buy_price),
                'sale_date': datetime.now()
            }
            sales.append(sale_record)
            self.sales_history.append(sale_record)
            
            print(f"📤 Sold {sold_from_batch} x {batch.product_name} from {batch.batch_id} "
                  f"@ ${batch.sell_price:.2f} (bought @ ${batch.buy_price:.2f})")
            
            # Update quantities
            remaining_to_sell -= sold_from_batch
            batch.quantity -= sold_from_batch
            
            # If there are items left in this batch, put it back at the front
            if batch.quantity > 0:
                self.inventory.appendleft(batch)
                break
        
        # Put back the batches we skipped (maintaining order)
        for batch in reversed(temp_batches):
            self.inventory.appendleft(batch)
        
        if remaining_to_sell > 0:
            print(f"⚠️  Warning: Could not sell {remaining_to_sell} items - insufficient stock!")
            
        return sales
    
    def get_inventory_status(self) -> dict:
        """Get current inventory status"""
        status = {}
        total_value = 0
        total_items = 0
        
        for batch in self.inventory:
            if batch.product_name not in status:
                status[batch.product_name] = {
                    'total_quantity': 0,
                    'batches': [],
                    'total_buy_value': 0,
                    'potential_revenue': 0
                }
            
            status[batch.product_name]['total_quantity'] += batch.quantity
            status[batch.product_name]['batches'].append({
                'batch_id': batch.batch_id,
                'quantity': batch.quantity,
                'buy_price': batch.buy_price,
                'sell_price': batch.sell_price,
                'purchase_date': batch.purchase_date.strftime('%Y-%m-%d %H:%M')
            })
            status[batch.product_name]['total_buy_value'] += batch.quantity * batch.buy_price
            status[batch.product_name]['potential_revenue'] += batch.quantity * batch.sell_price
            
            total_value += batch.quantity * batch.buy_price
            total_items += batch.quantity
        
        return {
            'products': status,
            'total_items': total_items,
            'total_inventory_value': total_value
        }
    
    def get_sales_summary(self) -> dict:
        """Get summary of all sales"""
        total_revenue = sum(sale['quantity_sold'] * sale['sell_price'] for sale in self.sales_history)
        total_cost = sum(sale['quantity_sold'] * sale['buy_price'] for sale in self.sales_history)
        total_profit = total_revenue - total_cost
        total_items_sold = sum(sale['quantity_sold'] for sale in self.sales_history)
        
        return {
            'total_items_sold': total_items_sold,
            'total_revenue': total_revenue,
            'total_cost': total_cost,
            'total_profit': total_profit,
            'profit_margin': (total_profit / total_revenue * 100) if total_revenue > 0 else 0,
            'sales_count': len(self.sales_history)
        }
    
    def display_inventory(self):
        """Display current inventory in a formatted way"""
        print("\n" + "="*60)
        print("CURRENT INVENTORY (FIFO Order)")
        print("="*60)
        
        if not self.inventory:
            print("No items in inventory")
            return
        
        for i, batch in enumerate(self.inventory, 1):
            print(f"{i}. {batch}")
        
        status = self.get_inventory_status()
        print(f"\nTotal Items: {status['total_items']}")
        print(f"Total Inventory Value: ${status['total_inventory_value']:,.2f}")
        print("="*60)