export default function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
