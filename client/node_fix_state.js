import fs from 'fs';
import path from 'path';

const posPath = path.resolve('client/src/pages/POSPage.tsx');
let lines = fs.readFileSync(posPath, 'utf8').split('\n');

// The starting line of POSPage component is around line 46
// We want to replace lines 48 through 61
// First, find 'export default function POSPage() {'
const startIndex = lines.findIndex(l => l.includes('export default function POSPage() {'));

if (startIndex !== -1) {
    const newStateVars = [
        '  const { cart, discount, discountType, paymentMethod, customerName, customerPhone, addItem, updateQuantity: updateStoreQuantity, removeItem: removeStoreItem, setDiscount, setDiscountType, setCustomerDetails, setPaymentMethod, clearCart } = useCartStore();',
        '  const [searchTerm, setSearchTerm] = useState("");',
        '  const [selectedCategory, setSelectedCategory] = useState<string>("all");',
        '  const [taxRate] = useState(0);',
        '  const [isProcessing, setIsProcessing] = useState(false);',
        '  const [showCheckout, setShowCheckout] = useState(false);',
        '  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);',
        '  const [completedInvoice, setCompletedInvoice] = useState<any>(null);',
        '  const [touchStartPos, setTouchStartPos] = useState<{ x: number, y: number } | null>(null);'
    ];

    // Remove 10 lines starting from startIndex + 2 (the cart and other states)
    lines.splice(startIndex + 2, 11);
    
    // Insert new states
    lines.splice(startIndex + 2, 0, ...newStateVars);
    
    fs.writeFileSync(posPath, lines.join('\n'));
    console.log("Successfully replaced state vars");
} else {
    console.log("Could not find POSPage declaration");
}
