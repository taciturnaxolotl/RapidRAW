import React, { useMemo } from 'react';

function formatExifTag(str) {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}

function parseDms(dmsString) {
  if (!dmsString) return null;
  const parts = dmsString.match(/(\d+\.?\d*)\s+deg\s+(\d+\.?\d*)\s+min\s+(\d+\.?\d*)\s+sec/);
  if (!parts) return null;
  const degrees = parseFloat(parts[1]);
  const minutes = parseFloat(parts[2]);
  const seconds = parseFloat(parts[3]);
  return degrees + (minutes / 60) + (seconds / 3600);
}

function MetadataItem({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs py-1.5 px-2 rounded odd:bg-bg-primary">
      <p className="font-semibold text-text-primary col-span-1 break-words">{label}</p>
      <p className="text-text-secondary col-span-2 break-words truncate" title={String(value)}>{String(value)}</p>
    </div>
  );
}

const KEY_CAMERA_SETTINGS_MAP = {
  FNumber: {
    label: 'F Number',
    format: (value) => `${value}`,
  },
  ExposureTime: {
    label: 'Shutter Speed',
    format: (value) => `${value}`,
  },
  PhotographicSensitivity: {
    label: 'ISO',
  },
  FocalLength: {
    label: 'Focal Distance',
    format: (value) => String(value).endsWith('mm') ? value : `${value} mm`,
  },
  LensModel: {
    label: 'Lens',
    format: (value) => String(value).replace(/"/g, ''),
  },
};

const KEY_SETTINGS_ORDER = ['FNumber', 'ExposureTime', 'PhotographicSensitivity', 'FocalLength', 'LensModel'];

export default function MetadataPanel({ selectedImage }) {
  const { keyCameraSettings, gpsData, otherExifEntries } = useMemo(() => {
    const exif = selectedImage?.exif || {};

    const keyCameraSettings = KEY_SETTINGS_ORDER
      .map(key => {
        const value = exif[key];
        if (value === undefined || value === null) {
          return null;
        }
        const config = KEY_CAMERA_SETTINGS_MAP[key];
        const formattedValue = config.format ? config.format(value) : value;
        return {
          key: key,
          label: config.label,
          value: formattedValue,
        };
      })
      .filter(Boolean);

    const gpsKeys = ['GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef', 'GPSAltitude', 'GPSAltitudeRef'];
    const latStr = exif.GPSLatitude;
    const latRef = exif.GPSLatitudeRef;
    const lonStr = exif.GPSLongitude;
    const lonRef = exif.GPSLongitudeRef;

    let gpsData = { lat: null, lon: null, altitude: exif.GPSAltitude || null };
    if (latStr && latRef && lonStr && lonRef) {
        const parsedLat = parseDms(latStr);
        const parsedLon = parseDms(lonStr);
        if (parsedLat !== null && parsedLon !== null) {
            gpsData.lat = latRef.toUpperCase() === 'S' ? -parsedLat : parsedLat;
            gpsData.lon = lonRef.toUpperCase() === 'W' ? -parsedLon : parsedLon;
        }
    }

    const otherExifEntries = Object.entries(exif)
      .filter(([key]) => !KEY_SETTINGS_ORDER.includes(key) && !gpsKeys.includes(key));

    return { keyCameraSettings, gpsData, otherExifEntries };
  }, [selectedImage?.exif]);

  const hasGps = gpsData.lat !== null && gpsData.lon !== null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Metadata</h2>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary">
        {selectedImage ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-base font-bold text-text-primary mb-2 border-b border-surface pb-1">File Properties</h3>
              <div className="flex flex-col gap-1">
                <MetadataItem label="Filename" value={selectedImage.path.split(/[\\/]/).pop()} />
                <MetadataItem label="Dimensions" value={`${selectedImage.width} x ${selectedImage.height}`} />
              </div>
            </div>

            {keyCameraSettings.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-text-primary mb-2 border-b border-surface pb-1">Key Camera Settings</h3>
                <div className="flex flex-col gap-1">
                  {keyCameraSettings.map((item) => (
                    <MetadataItem key={item.key} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>
            )}

            {hasGps && (
              <div>
                <h3 className="text-base font-bold text-text-primary mb-2 border-b border-surface pb-1">GPS Location</h3>
                <div className="flex flex-col gap-2">
                  <div className="relative rounded-md overflow-hidden border border-surface">
                    <iframe
                      width="100%"
                      height="180"
                      loading="lazy"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight="0"
                      marginWidth="0"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${gpsData.lon-0.01}%2C${gpsData.lat-0.01}%2C${gpsData.lon+0.01}%2C${gpsData.lat+0.01}&layer=mapnik&marker=${gpsData.lat}%2C${gpsData.lon}`}
                      className="pointer-events-none"
                    ></iframe>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${gpsData.lat}&mlon=${gpsData.lon}#map=15/${gpsData.lat}/${gpsData.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 cursor-pointer"
                      title="Click to open map in a new tab"
                    ></a>
                  </div>
                  <div className="flex flex-col gap-1">
                    <MetadataItem label="Latitude" value={gpsData.lat.toFixed(6)} />
                    <MetadataItem label="Longitude" value={gpsData.lon.toFixed(6)} />
                    {gpsData.altitude && <MetadataItem label="Altitude" value={gpsData.altitude} />}
                  </div>
                </div>
              </div>
            )}

            {otherExifEntries.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-text-primary mb-2 border-b border-surface pb-1">All EXIF Data</h3>
                <div className="flex flex-col gap-1">
                  {otherExifEntries.map(([tag, value]) => (
                    <MetadataItem key={tag} label={formatExifTag(tag)} value={value} />
                  ))}
                </div>
              </div>
            )}

            {Object.keys(selectedImage.exif || {}).length === 0 && (
               <p className="text-xs text-center text-text-secondary mt-4">No EXIF data found in this file.</p>
            )}

          </div>
        ) : (
          <p className="text-center">No image selected.</p>
        )}
      </div>
    </div>
  );
}