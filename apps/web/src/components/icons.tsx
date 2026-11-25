import { Baby, Bike, BookOpen, Palette, Wheat, Briefcase, Car, Drill, Flower2, Gem, House, Laptop, Music, PawPrint, Shapes, Shirt, Smartphone, Sofa, Tv, Wrench, type LucideIcon } from 'lucide-react';

const MAP: Record<string, LucideIcon> = { car: Car, house: House, tv: Tv, smartphone: Smartphone, laptop: Laptop, sofa: Sofa, flower: Flower2, shirt: Shirt, baby: Baby, bike: Bike, 'paw-print': PawPrint, briefcase: Briefcase, wrench: Wrench, drill: Drill, music: Music, gem: Gem, shapes: Shapes, 'book-open': BookOpen, palette: Palette, wheat: Wheat };

export function CategoryIcon({ name, className, strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  const I = MAP[name] ?? Shapes;
  return <I className={className} strokeWidth={strokeWidth} aria-hidden />;
}
