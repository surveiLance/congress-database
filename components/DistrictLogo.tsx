import Image from "next/image";

export default function DistrictLogo({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      className="district-logo"
      src="/rvp-logo.png"
      width={72}
      height={72}
      priority={priority}
      alt="RVP First Congressional District Office logo"
    />
  );
}
