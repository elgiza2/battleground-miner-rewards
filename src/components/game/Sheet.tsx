import type { ReactNode } from "react";
import { Drawer } from "vaul";

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet-content" aria-describedby={undefined}>
          <div className="sheet-grip" />
          <Drawer.Title className="mb-3 text-[19px] font-semibold tracking-tight text-ink">{title}</Drawer.Title>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
