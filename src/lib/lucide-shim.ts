import * as LucideIcons from 'lucide-react';
// No longer need: import { Disc } from 'lucide-react';

// Re-export all icons from lucide-react
export * from 'lucide-react';

// Provide a shim for DotFilled, mapping it to Disc from the namespace import
export const DotFilled = LucideIcons.Disc;