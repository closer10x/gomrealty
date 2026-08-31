/**
 * The comp's stylised Houston map. Used when NEXT_PUBLIC_MAPBOX_TOKEN is absent,
 * so the hero still reads as designed before the token is provisioned.
 */
export default function DecorativeMap() {
  return (
    <>
      <div className="hero-grid" />
      <div className="blk-park-a" />
      <div className="blk-park-b" />
      <div className="blk-water" />
      <div className="rd-i10" />
      <div className="rd-i10-ln" />
      <div className="rd-blt" />
      <div className="rd-minor" />
      <div className="map-label lbl-park">BEAR CREEK PARK</div>
      <div className="map-label lbl-bayou">BUFFALO BAYOU</div>
      <div className="map-label lbl-i10">I-10 KATY FWY</div>
      <div className="map-label lbl-blt">BELTWAY 8</div>
    </>
  );
}
