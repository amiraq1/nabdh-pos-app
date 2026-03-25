const fs = require('fs');

let appContent = fs.readFileSync('client/src/App.tsx', 'utf8');
appContent = appContent.replace('import { AnimatePresence, motion } from "framer-motion";', 'import { AnimatePresence, motion, Variants } from "framer-motion";');
appContent = appContent.replace('const pageVariants = {', 'const pageVariants: Variants = {');
fs.writeFileSync('client/src/App.tsx', appContent);

let profileContent = fs.readFileSync('client/src/pages/ProfilePage.tsx', 'utf8');
profileContent = profileContent.replace('import { motion } from "framer-motion";', 'import { motion, Variants } from "framer-motion";');
profileContent = profileContent.replace('const containerVariants = {', 'const containerVariants: Variants = {');
profileContent = profileContent.replace('const itemVariants = {', 'const itemVariants: Variants = {');
profileContent = profileContent.replace('user?.role === "admin"', '(user as any)?.role === "admin"');
fs.writeFileSync('client/src/pages/ProfilePage.tsx', profileContent);
console.log("TS Fixes Applied!");
