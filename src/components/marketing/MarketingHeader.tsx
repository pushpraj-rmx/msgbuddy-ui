import Link from "next/link";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export async function MarketingHeader() {
  const raw = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  const isAuthenticated = Boolean(raw && decodeURIComponent(raw));

  return (
    <header className="border-b border-base-300 bg-base-100/90 backdrop-blur">
      <div className="navbar mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="navbar-start">
          <div className="dropdown md:hidden">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
              <span className="sr-only">Open menu</span>
            </div>
            <ul
              tabIndex={0}
              className="menu dropdown-content z-50 mt-3 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow"
            >
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/" className="flex items-center">
            <BrandLogo className="h-7 w-auto" priority />
          </Link>
        </div>

        <div className="navbar-center hidden md:flex">
          <ul className="menu menu-horizontal gap-1 px-1">
            {NAV_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="navbar-end gap-2">
          {isAuthenticated ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Login
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
