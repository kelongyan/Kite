type Props = {
  title: string;
};

export function SectionHeader({ title }: Props) {
  return (
    <h1 className="text-[18px] leading-7 font-semibold tracking-tight">{title}</h1>
  );
}
