import type { ComponentType, SVGProps } from "react";

declare module "lucide-react" {
  export type LucideProps = SVGProps<SVGSVGElement> & {
    size?: string | number;
    color?: string;
    title?: string;
    strokeWidth?: number;
  };

  export const ArrowLeft: ComponentType<LucideProps>;
  export const Bell: ComponentType<LucideProps>;
  export const Car: ComponentType<LucideProps>;
  export const History: ComponentType<LucideProps>;
  export const Icon: ComponentType<LucideProps>;
  export const KeyRound: ComponentType<LucideProps>;
  export const LayoutDashboard: ComponentType<LucideProps>;
  export const LogOut: ComponentType<LucideProps>;
  export const MapPin: ComponentType<LucideProps>;
  export const Navigation: ComponentType<LucideProps>;
  export const Phone: ComponentType<LucideProps>;
  export const Shield: ComponentType<LucideProps>;
  export const ShieldCheck: ComponentType<LucideProps>;
  export const User: ComponentType<LucideProps>;
  export const UserRound: ComponentType<LucideProps>;
  export const Users: ComponentType<LucideProps>;
  export const Wallet: ComponentType<LucideProps>;
  export const Loader2: ComponentType<LucideProps>;
}
