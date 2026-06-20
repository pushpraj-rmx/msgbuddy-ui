import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
