"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { carouselColleges as colleges, type CarouselCollege } from '@/lib/college-carousel';
import './colleges.css';

gsap.registerPlugin(useGSAP);

function CollegeSlide({ college, active, number }: { college: CarouselCollege; active: boolean; number: string }) {
  return (
    <article className="college-slide" inert={!active} aria-hidden={!active} data-college={college.id}>
      <div className="college-character-motion">
        <div className="college-character-parallax">
          {/* Original transparent art: positioning, transition and parallax use separate wrappers. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="college-character" src={college.asset} alt={`${college.name} bobcat character`} draggable="false"
            style={{ '--character-x': college.position.x, '--character-y': college.position.y, '--character-scale': college.position.scale } as CSSProperties} />
        </div>
      </div>
      <div className="college-copy">
        <div className="college-reveal"><p className="college-kicker college-copy-item"><span /> {college.label}</p></div>
        <div className="college-reveal"><p className="college-prefix college-copy-item">{college.prefix}</p></div>
        <div className="college-reveal"><h2 className="college-title college-copy-item">{college.name}</h2></div>
        <div className="college-reveal"><p className="college-description college-copy-item">{college.description}</p></div>
        <div className="college-reveal"><div className="college-tags college-copy-item">{college.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
        <span className="college-slide-number" aria-hidden="true">{number}</span>
      </div>
    </article>
  );
}

function Arrow({ direction }: { direction: "previous" | "next" }) {
  return <svg viewBox="0 0 32 20" fill="none" aria-hidden="true"><path d={direction === 'previous' ? 'M30 10H3m0 0 8-8m-8 8 8 8' : 'M2 10h27m0 0-8-8m8 8-8 8'} stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export default function CollegeCarousel() {
  const scope = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const lock = useRef(false);
  const previous = useRef<number | null>(null);
  const direction = useRef(1);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const parallax = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc; background: gsap.QuickToFunc } | null>(null);
  const college = colleges[index];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const { contextSafe } = useGSAP(() => {
    const select = gsap.utils.selector(scope);
    const foreground = select('.college-character-parallax');
    parallax.current = {
      x: gsap.quickTo(foreground, 'x', { duration: 0.8, ease: 'power2.out' }),
      y: gsap.quickTo(foreground, 'y', { duration: 0.8, ease: 'power2.out' }),
      background: gsap.quickTo(select('.college-atmosphere'), 'x', { duration: 1.1, ease: 'power2.out' }),
    };
  }, { scope });

  useGSAP(() => {
    timeline.current?.kill();
    const element = scope.current!;
    const slides = element.querySelectorAll('.college-slide');
    const incoming = slides[index];
    const outgoing = previous.current === null ? null : slides[previous.current];
    const selectIncoming = gsap.utils.selector(incoming);
    const finish = () => { lock.current = false; setBusy(false); };
    lock.current = true;
    setBusy(true);
    const tl = gsap.timeline({ onComplete: finish });
    timeline.current = tl;
    if (reducedMotion) {
      gsap.set(slides, { autoAlpha: 0 });
      gsap.set(element.querySelectorAll('.college-character-parallax, .college-atmosphere'), { x: 0, y: 0 });
      gsap.set(incoming, { autoAlpha: 1 });
      gsap.set(selectIncoming('.college-character-motion, .college-copy-item'), { x: 0, y: 0, scale: 1, opacity: 1 });
      gsap.set(element, { '--college-accent': college.color, '--college-glow': college.glow, '--college-dark': college.dark });
      gsap.set(element.querySelectorAll('.college-diagonal'), { xPercent: 0, scaleX: 1 });
      finish();
    } else {
      const enterAt = outgoing && outgoing !== incoming ? 0.25 : 0;
      if (outgoing && outgoing !== incoming) {
        const selectOutgoing = gsap.utils.selector(outgoing);
        tl.to(selectOutgoing('.college-character-motion'), { x: -150, opacity: 0, scale: 0.9, duration: 0.35, ease: 'power2.in' }, 0)
          .to(selectOutgoing('.college-copy-item'), { y: -direction.current * 35, opacity: 0, stagger: 0.025, duration: 0.25 }, 0)
          .set(outgoing, { autoAlpha: 0 }, 0.4);
      }
      tl.to(element, { '--college-accent': college.color, '--college-glow': college.glow, '--college-dark': college.dark, duration: 0.85, ease: 'power2.inOut' }, 0)
        // Translating right exposes the panels' left edges. Keep reverse motion
        // anchored there and ease the diagonal back from a wider silhouette.
        .fromTo(element.querySelectorAll('.college-diagonal'), {
          xPercent: direction.current > 0 ? -12 : 0,
          scaleX: direction.current > 0 ? 1 : 1.12,
          transformOrigin: 'left center',
        }, { xPercent: 0, scaleX: 1, duration: 0.95, stagger: 0.04, ease: 'power3.inOut' }, 0)
        .set(incoming, { autoAlpha: 1 }, enterAt)
        .fromTo(selectIncoming('.college-character-motion'), { x: -180, y: 28, scale: 0.85, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.35)' }, enterAt)
        .fromTo(selectIncoming('.college-copy-item'), { y: direction.current * 65, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.065, ease: 'power3.out' }, enterAt + 0.07);
    }
    previous.current = index;
    return () => { tl.kill(); };
  }, { scope, dependencies: [index, reducedMotion] });

  function navigate(target: number, travelDirection: number) {
    if (lock.current || (target + colleges.length) % colleges.length === index) return;
    lock.current = true;
    direction.current = travelDirection;
    setBusy(true);
    setIndex((target + colleges.length) % colleges.length);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        navigate(index + (event.key === 'ArrowRight' ? 1 : -1), event.key === 'ArrowRight' ? 1 : -1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const moveParallax = contextSafe((event: PointerEvent<HTMLElement>) => {
    if (reducedMotion || event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const bounds = scope.current!.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    parallax.current?.x(x * 20);
    parallax.current?.y(y * 14);
    parallax.current?.background(x * -20);
  });
  const resetParallax = contextSafe(() => {
    parallax.current?.x(0); parallax.current?.y(0); parallax.current?.background(0);
  });

  return (
    <div className="lynx-page">
      <header className="lynx-header"><Link href="/" className="lynx-wordmark" aria-label="TXST Lynx"><span className="lynx-symbol">✳</span> TXST<span>LYNX</span><sup>β</sup></Link><span className="lynx-header-note">A CAMPUS OF POSSIBILITIES.</span><Link className="lynx-back" href="/">Back to ForAll <span>↗</span></Link></header>
      <div className="lynx-page-heading"><h1>YOUR PEOPLE. YOUR PLACE.</h1><span>01 — EXPLORE THE COLLEGES</span></div>
      <section className="college-carousel" ref={scope} aria-roledescription="carousel" aria-label="Explore Texas State colleges" onPointerMove={moveParallax} onPointerLeave={resetParallax} style={{ '--college-accent': colleges[0].color, '--college-glow': colleges[0].glow, '--college-dark': colleges[0].dark, '--previous-college-dark': colleges[(index + colleges.length - 1) % colleges.length].dark } as CSSProperties}>
        <div className="college-atmosphere" aria-hidden="true"><div className="college-diagonal college-panel-main" /><div className="college-diagonal college-panel-edge" /><div className="college-halo" /><div className="college-orbit orbit-one" /><div className="college-orbit orbit-two" /><div className="college-grid" /></div>
        <span className="college-watermark" aria-hidden="true">BOBCATS</span>
        <div className="college-stage-label"><span /> DIFFERENT PATHS. SAME BOBCAT SPIRIT.</div>
        <div className="college-slide-stack">{colleges.map((item, i) => <CollegeSlide key={item.id} college={item} active={i === index} number={String(i + 1).padStart(2, '0')} />)}</div>
        <Link className="college-enter" href={`/colleges/${college.slug}`} aria-label={`Enter ${college.feedName} feed`} tabIndex={busy ? -1 : 0} aria-hidden={busy || undefined}>Enter college feed <span aria-hidden="true">↗</span></Link>
        <div className="college-controls"><div className="college-counter"><strong>{String(index + 1).padStart(2, '0')}</strong><span>/ {String(colleges.length).padStart(2, '0')}</span></div><div className="college-arrows"><button type="button" aria-label="Previous college" aria-disabled={busy} onClick={() => navigate(index - 1, -1)}><Arrow direction="previous" /></button><button type="button" aria-label="Next college" aria-disabled={busy} onClick={() => navigate(index + 1, 1)}><Arrow direction="next" /></button></div><span className="college-key-hint">← → TO EXPLORE</span></div>
        <span className="college-stage-caption">FIND YOUR KIND OF EXTRAORDINARY.</span>
        <p className="lynx-sr-only" role="status" aria-live="polite" aria-atomic="true">{college.name}, college {index + 1} of {colleges.length}</p>
      </section>
      <nav className="college-picker" aria-label="Choose a college">{colleges.map((item, i) => <button type="button" key={item.id} className={index === i ? 'is-active' : ''} aria-current={index === i ? 'true' : undefined} aria-disabled={busy} onClick={() => navigate(i, i > index ? 1 : -1)} style={{ '--picker-color': item.color } as CSSProperties}><span className="college-picker-number">{String(i + 1).padStart(2, '0')}</span><span>{item.id === 'engineering' ? 'Science & Eng.' : item.id === 'fine_arts' ? 'Arts & Comm.' : item.id === 'business' ? 'Business' : item.id === 'graduate' ? 'Graduate' : item.id === 'university' ? 'University' : item.name}</span><i /></button>)}</nav>
      <div className="lynx-bottom"><p>Ten colleges. Countless connections.<br /><span>Your next chapter starts with your people.</span></p><span className="lynx-prototype">TXST LYNX <i /> COLLEGE EXPLORER</span></div>
    </div>
  );
}
