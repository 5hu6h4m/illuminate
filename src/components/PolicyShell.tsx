import { SiteFooter } from "@/components/SiteFooter";
import { Container } from "@/components/ui/Container";

export function PolicyShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="policy-shell"><main><Container><div className="mx-auto max-w-3xl px-5 py-16 md:py-24"><p className="text-eyebrow">{eyebrow}</p><h1 className="mt-3 text-display">{title}</h1><hr className="thread-divider" aria-hidden />{children}</div></Container></main><SiteFooter /></div>;
}
