import { Link } from 'react-router-dom';
import { Camera, ChevronRight, LayoutGrid } from 'lucide-react';

/** First screen behind the + button: one sheet, or many sheets from one group photo. */
export function AddChoice() {
  return (
    <main className="page">
      <h1>What are you adding?</h1>
      <p className="sub">You can add more photos to the same order afterwards.</p>
      <Link to="/add/one" className="choice">
        <span className="choice-icon"><Camera size={26} strokeWidth={1.6} aria-hidden /></span>
        <span className="choice-text"><b>One sheet</b><span>A photo or a shop screenshot</span></span>
        <ChevronRight size={20} aria-hidden />
      </Link>
      <Link to="/add/many" className="choice">
        <span className="choice-icon"><LayoutGrid size={26} strokeWidth={1.6} aria-hidden /></span>
        <span className="choice-text"><b>Many sheets</b><span>Several sheets laid out in one photo</span></span>
        <ChevronRight size={20} aria-hidden />
      </Link>
    </main>
  );
}
