import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence, motion, Variants } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import BottomNav from "./components/BottomNav";
import OfflineIndicator from "./components/OfflineIndicator";

const Home = lazy(() => import("./pages/Home"));
const POSPage = lazy(() => import("./pages/POSPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const pageVariants: Variants = {
  initial: { opacity: 0, y: 15, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, filter: "blur(2px)", transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }
};

function AnimatedRouter() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        className="h-full w-full min-h-[100dvh]"
      >
        <Suspense fallback={<RouteLoadingFallback />}>
          <Switch location={location}>
            <Route path="/" component={Home} />
            <Route path="/pos" component={POSPage} />
            <Route path="/products" component={ProductsPage} />
            <Route path="/categories" component={CategoriesPage} />
            <Route path="/inventory" component={InventoryPage} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/expenses" component={ExpensesPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-background">
      <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-primary animate-spin" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider delayDuration={300}>
          <Toaster position="bottom-center" toastOptions={{ className: 'font-display tracking-wide border-border/50 backdrop-blur-md' }} />
          <OfflineIndicator />
          <AnimatedRouter />
          <BottomNav />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
