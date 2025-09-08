# FIFO Inventory Management System

A Python implementation of a First-In-First-Out (FIFO) inventory management system that tracks batches of products with different purchase and selling prices.

## Features

- **FIFO Logic**: Automatically sells oldest inventory first
- **Batch Tracking**: Each batch maintains its own buy/sell prices
- **Profit Calculation**: Tracks profit per batch and overall
- **Inventory Status**: Real-time inventory valuation and status
- **Sales History**: Complete record of all sales transactions
- **Interactive Mode**: User-friendly command-line interface
- **Data Persistence**: Save/load inventory to/from JSON files

## Installation

No external dependencies required. Uses Python standard library only.

```bash
# Clone or download the files
python3 fifo_inventory.py
```

## Usage

### Quick Example

Run the example script to see the HP EliteBook scenario in action:

```bash
python3 example_usage.py
```

This demonstrates:
- Adding 5 HP EliteBooks bought at $100, selling at $150
- Adding 5 more HP EliteBooks bought at $120, selling at $170
- Selling laptops using FIFO principle (oldest stock first)

### Interactive Mode

For a full-featured interactive experience:

```bash
python3 interactive_inventory.py
```

Available commands:
1. **Add new batch**: Add products with specific buy/sell prices
2. **Sell items**: Sell products (automatically uses FIFO)
3. **View inventory**: See current stock in FIFO order
4. **View sales summary**: Check total sales, revenue, and profit
5. **Save inventory**: Export to JSON file
6. **Load inventory**: Import from JSON file
7. **Quick demo**: Run the HP EliteBook scenario

### Programmatic Usage

```python
from fifo_inventory import FIFOInventory

# Create inventory system
inventory = FIFOInventory()

# Add first batch
inventory.add_batch(
    product_name="HP EliteBook",
    quantity=5,
    buy_price=100.00,
    sell_price=150.00
)

# Add second batch
inventory.add_batch(
    product_name="HP EliteBook",
    quantity=5,
    buy_price=120.00,
    sell_price=170.00
)

# Sell items (FIFO - will sell from first batch first)
sales = inventory.sell_items("HP EliteBook", 7)

# Check inventory status
status = inventory.get_inventory_status()
print(f"Remaining items: {status['total_items']}")

# Get sales summary
summary = inventory.get_sales_summary()
print(f"Total profit: ${summary['total_profit']:.2f}")
```

## How FIFO Works

When you sell items, the system automatically:

1. Searches for the oldest batch of the requested product
2. Sells from that batch first
3. If the batch is depleted, moves to the next oldest batch
4. Tracks profit based on each batch's specific buy/sell prices

### Example Scenario

Your HP EliteBook example:
- **Batch 1**: 5 laptops @ $100 cost, $150 sell price
- **Batch 2**: 5 laptops @ $120 cost, $170 sell price

When selling 7 laptops:
- First 5 come from Batch 1 (profit: $50 each = $250)
- Next 2 come from Batch 2 (profit: $50 each = $100)
- Total profit: $350

## Data Structure

The system uses a deque (double-ended queue) for efficient FIFO operations:

```python
@dataclass
class InventoryBatch:
    product_name: str
    quantity: int
    buy_price: float
    sell_price: float
    batch_id: str
    purchase_date: datetime
```

## File Structure

- `fifo_inventory.py`: Core FIFO inventory implementation
- `example_usage.py`: Demonstrates the HP EliteBook scenario
- `interactive_inventory.py`: Interactive command-line interface
- `README.md`: This documentation file

## Benefits of FIFO

1. **Accurate Profit Tracking**: Each sale uses actual historical costs
2. **Inventory Valuation**: Always know the real value of your stock
3. **Compliance**: Many accounting standards require or prefer FIFO
4. **Simplicity**: Intuitive model - sell oldest items first

## License

MIT License - Feel free to use and modify as needed.