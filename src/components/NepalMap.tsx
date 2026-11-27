import React, { useMemo, useState } from 'react';
import nepalGeo from '../data/nepal-districts.json';
import { DashboardAnalytics } from '../types/index.ts';
import { PROVINCES } from '../data/nepalMasterData.ts';
import { formatNum, formatPct } from '../utils/nepaliDate.ts';

interface Props {
  districtStats: DashboardAnalytics['districtStats'];
  provinceStats: DashboardAnalytics['provinceStats'];
  selectedProvinceIds: number[];
  selectedDistrictIds: number[];
  onSelectProvince: (provinceId: number) => void;
  onSelectDistrict: (districtId: number) => void;
  lang: 'ne' | 'en';
}

interface GeoFeature {
  type: string;
  properties: {
    DISTRICT: string;
    HQ?: string;
    PROVINCE: number;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

const PROVINCE_PALETTE: Record<number, string> = {
  1: '#1E40AF',
  2: '#0F766E',
  3: '#0F294D',
  4: '#4338CA',
  5: '#B45309',
  6: '#7C2D12',
  7: '#991B1B',
};

function getComplianceFill(avgPct: number, totalOffices: number, submittedOffices: number): string {
  if (totalOffices === 0) return '#E2E8F0';
  if (submittedOffices === 0) return '#CBD5E1';
  if (avgPct >= 85) return '#15803D';
  if (avgPct >= 70) return '#2563EB';
  if (avgPct >= 50) return '#D97706';
  return '#DC2626';
}

export function NepalMap({
  districtStats,
  provinceStats,
  selectedProvinceIds,
  selectedDistrictIds,
  onSelectProvince,
  onSelectDistrict,
  lang,
}: Props) {
  const [mapMode, setMapMode] = useState<'compliance' | 'province'>('compliance');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const statsByGeoKey = useMemo(() => {
    const map = new Map<string, DashboardAnalytics['districtStats'][number]>();
    for (const d of districtStats) map.set(d.geo_key, d);
    return map;
  }, [districtStats]);

  const projected = useMemo(() => {
    const features = (nepalGeo as unknown as { features: GeoFeature[] }).features;
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const visitCoords = (rings: number[][][]) => {
      for (const ring of rings) {
        for (const pt of ring) {
          if (pt[0] < minLon) minLon = pt[0];
          if (pt[0] > maxLon) maxLon = pt[0];
          if (pt[1] < minLat) minLat = pt[1];
          if (pt[1] > maxLat) maxLat = pt[1];
        }
      }
    };

    for (const f of features) {
      if (f.geometry.type === 'Polygon') {
        visitCoords(f.geometry.coordinates as number[][][]);
      } else {
        for (const poly of f.geometry.coordinates as number[][][][]) {
          visitCoords(poly);
        }
      }
    }

    const width = 940;
    const height = 470;
    const pad = 18;
    const cosLat = Math.cos((28.3 * Math.PI) / 180);
    const lonSpan = (maxLon - minLon) * cosLat;
    const latSpan = maxLat - minLat;
    const scale = Math.min((width - pad * 2) / lonSpan, (height - pad * 2) / latSpan);
    const offsetX = (width - lonSpan * scale) / 2;
    const offsetY = (height - latSpan * scale) / 2;

    const projectPt = (lon: number, lat: number): [number, number] => {
      const x = offsetX + (lon - minLon) * cosLat * scale;
      const y = offsetY + (maxLat - lat) * scale;
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    };

    const ringToPath = (ring: number[][]) =>
      ring
        .map((pt, i) => {
          const [x, y] = projectPt(pt[0], pt[1]);
          return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' ') + ' Z';

    return features.map((f) => {
      let d = '';
      if (f.geometry.type === 'Polygon') {
        d = (f.geometry.coordinates as number[][][]).map(ringToPath).join(' ');
      } else {
        d = (f.geometry.coordinates as number[][][][])
          .map((poly) => poly.map(ringToPath).join(' '))
          .join(' ');
      }
      return {
        geoKey: f.properties.DISTRICT,
        provinceId: f.properties.PROVINCE,
        d,
      };
    });
  }, []);

  const hoveredStat = hoveredKey ? statsByGeoKey.get(hoveredKey) : null;
  const hoveredProvince = hoveredStat ? PROVINCES.find((p) => p.id === hoveredStat.province_id) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-[#0F294D]">
            {lang === 'ne'
              ? 'नेपालको भौगोलिक अनुगमन नक्सा'
              : 'Nepal Geographical Monitoring Map'}
          </h3>
          <p className="text-xs text-slate-500">
            {lang === 'ne'
              ? 'जिल्लामा क्लिक गरी सम्बन्धित क्षेत्रको कार्यालय सूची र तथ्याङ्क फिल्टर गर्नुहोस्'
              : 'Click any district on the map to filter dashboard analytics and office listings'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            onClick={() => setMapMode('compliance')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
              mapMode === 'compliance' ? 'bg-white text-[#0F294D] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'ne' ? 'कार्यान्वयन प्रतिशत' : 'Compliance %'}
          </button>
          <button
            type="button"
            onClick={() => setMapMode('province')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
              mapMode === 'province' ? 'bg-white text-[#0F294D] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {lang === 'ne' ? 'प्रदेशगत विभाजन' : 'By Province'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-8 relative bg-slate-50/70 border border-slate-200 rounded-md p-3">
          <svg viewBox="0 0 940 470" className="w-full h-auto select-none">
            {projected.map((item) => {
              const stat = statsByGeoKey.get(item.geoKey);
              const isSelected =
                (stat && selectedDistrictIds.includes(stat.district_id)) ||
                selectedProvinceIds.includes(item.provinceId);
              const isHovered = hoveredKey === item.geoKey;

              const fill =
                mapMode === 'compliance'
                  ? getComplianceFill(stat?.avg_impl_pct || 0, stat?.total_offices || 0, stat?.submitted_offices || 0)
                  : PROVINCE_PALETTE[item.provinceId] || '#1E40AF';

              return (
                <path
                  key={item.geoKey}
                  d={item.d}
                  fill={fill}
                  fillOpacity={isSelected ? 1 : hoveredKey && !isHovered ? 0.68 : 0.88}
                  stroke={isSelected || isHovered ? '#0F172A' : '#FFFFFF'}
                  strokeWidth={isSelected ? 1.8 : isHovered ? 1.4 : 0.75}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => setHoveredKey(item.geoKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => {
                    if (stat) onSelectDistrict(stat.district_id);
                  }}
                />
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredStat && (
            <div className="mt-2 sm:mt-0 sm:absolute sm:bottom-3 sm:left-3 bg-white/95 border border-slate-300 rounded-md px-3.5 py-2.5 shadow-sm pointer-events-none text-xs max-w-xs">
              <div className="font-bold text-[#0F294D]">
                {lang === 'ne' ? hoveredStat.district_name_np : hoveredStat.district_name_en}
                <span className="text-slate-400 font-normal"> · {lang === 'ne' ? hoveredProvince?.name_np : hoveredProvince?.name_en}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-700 tabular-nums">
                <span>{lang === 'ne' ? 'आबद्ध कार्यालय:' : 'Offices:'} <strong>{formatNum(hoveredStat.total_offices, lang)}</strong></span>
                <span>{lang === 'ne' ? 'पेश गरेका:' : 'Submitted:'} <strong>{formatNum(hoveredStat.submitted_offices, lang)}</strong></span>
                <span>{lang === 'ne' ? 'कार्यान्वयन:' : 'Compliance:'} <strong>{formatPct(hoveredStat.avg_impl_pct, lang)}</strong></span>
                <span>{lang === 'ne' ? 'फर्छ्योट निवेदन:' : 'Disposed:'} <strong>{formatNum(hoveredStat.total_disposed, lang)}</strong></span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600">
            {mapMode === 'compliance' ? (
              <>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#15803D]" /> {lang === 'ne' ? '८५%+ (उत्कृष्ट)' : '85%+ (High)'}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#2563EB]" /> {lang === 'ne' ? '७०–८४%' : '70–84%'}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#D97706]" /> {lang === 'ne' ? '५०–६९%' : '50–69%'}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#DC2626]" /> {lang === 'ne' ? '<५०% (सुधार आवश्यक)' : '<50% (Low)'}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#CBD5E1]" /> {lang === 'ne' ? 'पेश नभएको' : 'Not Submitted'}</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#E2E8F0]" /> {lang === 'ne' ? 'कार्यालय आबद्ध नभएको' : 'No Registered Office'}</span>
              </>
            ) : (
              PROVINCES.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PROVINCE_PALETTE[p.id] }} />
                  {lang === 'ne' ? p.name_np : p.name_en}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Right: Province-by-Province Summary Cards */}
        <div className="xl:col-span-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {lang === 'ne' ? 'प्रदेशगत प्रतिवेदन तथा कार्यान्वयन अवस्था (क्लिक गरी फिल्टर गर्नुहोस्)' : 'Province Summary (Click to Filter)'}
          </div>
          {provinceStats.map((ps) => {
            const active = selectedProvinceIds.includes(ps.province_id);
            const subRate = ps.total_offices > 0 ? Math.round((ps.submitted_offices / ps.total_offices) * 100) : 0;
            return (
              <button
                key={ps.province_id}
                type="button"
                onClick={() => onSelectProvince(ps.province_id)}
                className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                  active ? 'bg-[#0F294D]/5 border-[#0F294D] ring-1 ring-[#0F294D]' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F294D] truncate">
                    {lang === 'ne' ? ps.province_name_np : ps.province_name_en}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">
                    {formatPct(ps.avg_impl_pct, lang)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 tabular-nums">
                  <span>
                    {lang === 'ne' ? 'पेश:' : 'Submitted:'} {formatNum(ps.submitted_offices, lang)}/{formatNum(ps.total_offices, lang)} ({formatNum(subRate, lang)}%)
                  </span>
                  <span>
                    {lang === 'ne' ? 'फर्छ्योट:' : 'Disposed:'} {formatNum(ps.total_disposed, lang)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-[#0F294D] rounded-full"
                    style={{ width: `${Math.min(100, ps.avg_impl_pct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
