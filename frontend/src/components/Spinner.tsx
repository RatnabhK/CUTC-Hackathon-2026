interface Props {
  size?: number;
  dark?: boolean;
}

export function Spinner({ size = 14, dark = false }: Props) {
  return (
    <span
      className="spinner"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, size / 7),
        borderColor: dark ? "rgba(5, 38, 31, 0.25)" : undefined,
        borderTopColor: dark ? "#05261f" : undefined,
      }}
    />
  );
}
