import { ScaleProvider } from "@/components/scale/provider";
export const metadata = { title: "رشد | Growth Engine" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ScaleProvider>{children}</ScaleProvider>;
}
