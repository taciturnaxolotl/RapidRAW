import { useState, useEffect, useRef, forwardRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import {
  Folder,
  Image as ImageIcon,
  RefreshCw,
  Settings,
  Home,
  Star as StarIcon,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import Button from '../ui/Button';
import SettingsPanel from './SettingsPanel';
import { THEMES, DEFAULT_THEME_ID } from '../../utils/themes';

const sortOptions = [
  { key: 'name', order: 'asc', label: 'File Name (A-Z)' },
  { key: 'name', order: 'desc', label: 'File Name (Z-A)' },
  { key: 'date', order: 'desc', label: 'Date (Newest)' },
  { key: 'date', order: 'asc', label: 'Date (Oldest)' },
  { key: 'rating', order: 'desc', label: 'Rating (Highest)' },
  { key: 'rating', order: 'asc', label: 'Rating (Lowest)' },
];

const ratingFilterOptions = [
  { value: 0, label: 'Show All' },
  { value: 1, label: '1 & up' },
  { value: 2, label: '2 & up' },
  { value: 3, label: '3 & up' },
  { value: 4, label: '4 & up' },
  { value: 5, label: '5 only' },
];

const rawStatusOptions = [
  { key: 'all', label: 'All Types' },
  { key: 'rawOnly', label: 'RAW Only' },
  { key: 'nonRawOnly', label: 'Non-RAW Only' },
];

const thumbnailSizeOptions = [
  { id: 'small', label: 'Small', size: 160 },
  { id: 'medium', label: 'Medium', size: 240 },
  { id: 'large', label: 'Large', size: 320 },
];

const customOuterElement = forwardRef((props, ref) => (
  <div ref={ref} {...props} className="custom-scrollbar" />
));
customOuterElement.displayName = 'CustomOuterElement';


function DropdownMenu({ buttonContent, buttonTitle, children, contentClassName = "w-56" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 bg-surface text-text-primary shadow-none p-0 flex items-center justify-center"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={buttonTitle}
      >
        {buttonContent}
      </Button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`absolute right-0 mt-2 ${contentClassName} origin-top-right z-20`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
          >
            <div
              className="bg-surface/90 backdrop-blur-md rounded-lg shadow-xl"
              role="menu"
              aria-orientation="vertical"
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThumbnailSizeOptions({ selectedSize, onSelectSize }) {
  return (
    <>
      <div className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Thumbnail Size</div>
      {thumbnailSizeOptions.map((option) => {
        const isSelected = selectedSize === option.id;
        return (
          <button
            key={option.id}
            onClick={() => onSelectSize(option.id)}
            className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors duration-150 ${isSelected ? 'bg-card-active text-text-primary font-semibold' : 'text-text-primary hover:bg-bg-primary'}`}
            role="menuitem"
          >
            <span>{option.label}</span>
            {isSelected && <Check size={16} />}
          </button>
        );
      })}
    </>
  );
}

function FilterOptions({ filterCriteria, setFilterCriteria }) {
  const handleRatingFilterChange = (rating) => {
    setFilterCriteria(prev => ({ ...prev, rating }));
  };

  const handleRawStatusChange = (rawStatus) => {
    setFilterCriteria(prev => ({ ...prev, rawStatus }));
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Filter by Rating</div>
        {ratingFilterOptions.map((option) => {
          const isSelected = filterCriteria.rating === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleRatingFilterChange(option.value)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors duration-150 ${isSelected ? 'bg-card-active text-text-primary font-semibold' : 'text-text-primary hover:bg-bg-primary'}`}
              role="menuitem"
            >
              <span className="flex items-center gap-2">
                {option.value > 0 && <StarIcon size={16} className="text-accent fill-accent" />}
                <span>{option.label}</span>
              </span>
              {isSelected && <Check size={16} />}
            </button>
          );
        })}
      </div>

      <div>
        <div className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Filter by File Type</div>
        {rawStatusOptions.map((option) => {
          const isSelected = (filterCriteria.rawStatus || 'all') === option.key;
          return (
            <button
              key={option.key}
              onClick={() => handleRawStatusChange(option.key)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors duration-150 ${isSelected ? 'bg-card-active text-text-primary font-semibold' : 'text-text-primary hover:bg-bg-primary'}`}
              role="menuitem"
            >
              <span>{option.label}</span>
              {isSelected && <Check size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SortOptions({ sortCriteria, setSortCriteria }) {
  return (
    <>
      <div className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Sort by</div>
      {sortOptions.map((option) => {
        const isSelected = sortCriteria.key === option.key && sortCriteria.order === option.order;
        return (
          <button
            key={`${option.key}-${option.order}`}
            onClick={() => setSortCriteria({ key: option.key, order: option.order })}
            className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between transition-colors duration-150 ${isSelected ? 'bg-card-active text-text-primary font-semibold' : 'text-text-primary hover:bg-bg-primary'}`}
            role="menuitem"
          >
            <span>{option.label}</span>
            {isSelected && <Check size={16} />}
          </button>
        );
      })}
    </>
  );
}

function ViewOptionsDropdown({
  thumbnailSize,
  onSelectSize,
  filterCriteria,
  setFilterCriteria,
  sortCriteria,
  setSortCriteria,
}) {
  const isFilterActive = filterCriteria.rating > 0 || 
                        (filterCriteria.rawStatus && filterCriteria.rawStatus !== 'all')

  return (
    <DropdownMenu
      buttonContent={
        <>
          <SlidersHorizontal className="w-8 h-8" />
          {isFilterActive && <div className="absolute -top-1 -right-1 bg-accent rounded-full w-3 h-3" />}
        </>
      }
      buttonTitle="View Options"
      contentClassName="w-[720px]"
    >
      <div className="flex">
        <div className="w-1/4 p-2 border-r border-border-color">
          <ThumbnailSizeOptions selectedSize={thumbnailSize} onSelectSize={onSelectSize} />
        </div>
        <div className="w-2/4 p-2 border-r border-border-color">
          <FilterOptions filterCriteria={filterCriteria} setFilterCriteria={setFilterCriteria} />
        </div>
        <div className="w-1/4 p-2">
          <SortOptions sortCriteria={sortCriteria} setSortCriteria={setSortCriteria} />
        </div>
      </div>
    </DropdownMenu>
  );
}


function Thumbnail({ path, data, onImageClick, onImageDoubleClick, isSelected, isActive, rating, onContextMenu }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (data) setIsLoaded(true);
  }, [data]);

  const ringClass = isActive ? 'ring-2 ring-accent' : isSelected ? 'ring-2 ring-gray-400' : 'hover:ring-2 hover:ring-hover-color';

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onImageClick(path, e); }}
      onDoubleClick={() => onImageDoubleClick(path)}
      onContextMenu={onContextMenu}
      className={`aspect-square bg-surface rounded-md overflow-hidden cursor-pointer group relative transition-all duration-150 ${ringClass}`}
      title={path.split(/[\\/]/).pop()}
    >
      {data ? (
        <img src={data} alt={path} className={`w-full h-full object-cover group-hover:scale-[1.02] transition ease-in-out duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface">
          <ImageIcon className="text-text-secondary animate-pulse" />
        </div>
      )}
      {rating > 0 && (
        <div className="absolute top-1.5 right-1.5 bg-bg-primary/50 rounded-full px-1.5 py-0.5 text-xs text-text-primary flex items-center gap-1 backdrop-blur-sm">
          <span>{rating}</span>
          <StarIcon size={12} className="text-accent fill-accent" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-white text-xs truncate">{path.split(/[\\/]/).pop()}</p>
      </div>
    </div>
  );
}

const Cell = ({ columnIndex, rowIndex, style, data }) => {
  const { imageList, columnCount, thumbnails, imageRatings, onImageClick, onImageDoubleClick, multiSelectedPaths, activePath, onContextMenu } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= imageList.length) return null;
  const imageFile = imageList[index];

  return (
    <div style={style}>
      <motion.div
        key={imageFile.path}
        initial={{ opacity: 0.5, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="p-2 h-full"
      >
        <Thumbnail
          path={imageFile.path}
          data={thumbnails[imageFile.path]}
          rating={imageRatings?.[imageFile.path] || 0}
          onImageClick={onImageClick}
          onImageDoubleClick={onImageDoubleClick}
          isSelected={multiSelectedPaths.includes(imageFile.path)}
          isActive={activePath === imageFile.path}
          onContextMenu={(e) => onContextMenu(e, imageFile.path)}
        />
      </motion.div>
    </div>
  );
};

export default function MainLibrary({
  imageList, onImageClick, onImageDoubleClick, onContextMenu, onEmptyAreaContextMenu, multiSelectedPaths, activePath, rootPath, currentFolderPath, onOpenFolder, thumbnails, imageRatings, appSettings, onContinueSession, onGoHome, onClearSelection, sortCriteria, setSortCriteria, filterCriteria, setFilterCriteria, onSettingsChange, onLibraryRefresh, theme, initialScrollOffset, onScroll,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [thumbnailSize, setThumbnailSize] = useState('medium');
  const [supportedTypes, setSupportedTypes] = useState(null);

  useEffect(() => { getVersion().then(setAppVersion); }, []);

  useEffect(() => {
    invoke('get_supported_file_types')
      .then(types => setSupportedTypes(types))
      .catch(err => console.error('Failed to load supported file types:', err));
  }, []);

  if (!rootPath) {
    if (!appSettings) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full rounded-lg bg-bg-primary p-8 text-center">
          <ImageIcon size={80} className="text-accent opacity-20 mb-6 animate-pulse" />
          <h1 className="text-3xl font-bold text-primary mb-2">RapidRAW</h1>
          <p className="text-text-secondary mb-8">Loading settings...</p>
        </div>
      );
    }
    const hasLastPath = !!appSettings.lastRootPath;
    const currentThemeId = theme || DEFAULT_THEME_ID;
    const selectedTheme = THEMES.find(t => t.id === currentThemeId) || THEMES.find(t => t.id === DEFAULT_THEME_ID);
    const splashImage = selectedTheme.splashImage;
    return (
      <div className="flex-1 flex h-full bg-bg-secondary overflow-hidden shadow-lg">
        <div className="w-1/2 hidden md:block relative">
          <AnimatePresence>
            <motion.img key={splashImage} src={splashImage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: 'easeInOut' }} className="absolute inset-0 w-full h-full object-cover" alt="Splash screen background" />
          </AnimatePresence>
        </div>
        <div className="w-full md:w-1/2 flex flex-col p-8 lg:p-16 relative">
          {showSettings ? (
            <SettingsPanel onBack={() => setShowSettings(false)} appSettings={appSettings} onSettingsChange={onSettingsChange} rootPath={rootPath} onLibraryRefresh={onLibraryRefresh} />
          ) : (
            <>
              <div className="my-auto text-left">
                <h1 className="text-5xl font-bold text-text-primary text-shadow-shiny mb-4">RapidRAW</h1>
                <p className="text-text-secondary mb-10 max-w-md">{hasLastPath ? <>Welcome back!<br />Continue where you left off or start a new session.</> : "A blazingly fast, GPU-accelerated RAW image editor. Open a folder to begin."}</p>
                <div className="flex flex-col w-full max-w-xs gap-4">
                  {hasLastPath && <Button onClick={onContinueSession} size="lg" className="rounded-md h-11 w-full flex justify-start items-center"><RefreshCw size={20} className="mr-2" /> Continue Session</Button>}
                  <div className="flex items-center gap-2">
                    <Button onClick={onOpenFolder} size="lg" className={`rounded-md flex-grow flex justify-start items-center h-11 ${hasLastPath ? 'bg-surface text-text-primary shadow-none' : ''}`}><Folder size={20} className="mr-2" />{hasLastPath ? "Change Folder" : "Open Folder"}</Button>
                    <Button onClick={() => setShowSettings(true)} size="lg" variant="ghost" className="px-3 bg-surface text-text-primary shadow-none h-11" title="Settings"><Settings size={20} /></Button>
                  </div>
                </div>
              </div>
              <p className="absolute bottom-8 left-8 lg:left-16 text-xs text-text-secondary">{appVersion && `Version ${appVersion} - `}Images by Timon Käch (@timonkaech.photography)</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-bg-secondary rounded-lg overflow-hidden">
      <header className="p-4 flex-shrink-0 flex justify-between items-center border-b border-border-color">
        <div>
          <h2 className="text-2xl font-bold text-primary">Library</h2>
          <p className="text-sm text-text-secondary truncate">{currentFolderPath}</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewOptionsDropdown
            thumbnailSize={thumbnailSize}
            onSelectSize={setThumbnailSize}
            filterCriteria={filterCriteria}
            setFilterCriteria={setFilterCriteria}
            sortCriteria={sortCriteria}
            setSortCriteria={setSortCriteria}
          />
          <Button onClick={onOpenFolder} className="h-12 w-12 bg-surface text-text-primary shadow-none p-0 flex items-center justify-center" title="Open another folder"><Folder className="w-8 h-8" /></Button>
          <Button onClick={onGoHome} className="h-12 w-12 bg-surface text-text-primary shadow-none p-0 flex items-center justify-center" title="Go to Home Screen"><Home className="w-8 h-8" /></Button>
        </div>
      </header>
      {imageList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-secondary" onContextMenu={onEmptyAreaContextMenu}><p>No images found that match your filter.</p></div>
      ) : (
        <div className="flex-1 w-full h-full" onClick={onClearSelection} onContextMenu={onEmptyAreaContextMenu}>
          <AutoSizer>
            {({ height, width }) => {
              const SCROLLBAR_SIZE = 10;
              const PADDING = 8;
              const minThumbWidth = thumbnailSizeOptions.find(o => o.id === thumbnailSize)?.size || 240;
              const columnCount = Math.max(1, Math.floor(width / (minThumbWidth + PADDING * 2)));
              const rowCount = Math.ceil(imageList.length / columnCount);
              const preliminaryCellWidth = width / columnCount;
              const isScrollbarVisible = (rowCount * preliminaryCellWidth) > height;
              const gridWidth = isScrollbarVisible ? width - SCROLLBAR_SIZE : width;
              const cellWidth = gridWidth / columnCount;
              const cellHeight = cellWidth;

              return (
                <Grid
                  key={`${sortCriteria.key}-${sortCriteria.order}-${filterCriteria.rating}-${filterCriteria.rawStatus || 'all'}`}
                  outerElementType={customOuterElement}
                  height={height}
                  width={width}
                  columnCount={columnCount}
                  rowCount={rowCount}
                  columnWidth={cellWidth}
                  rowHeight={cellHeight}
                  itemData={{ imageList, columnCount, thumbnails, imageRatings, onImageClick, onImageDoubleClick, multiSelectedPaths, activePath, onContextMenu }}
                  initialScrollTop={initialScrollOffset}
                  onScroll={onScroll}
                >{Cell}</Grid>
              );
            }}
          </AutoSizer>
        </div>
      )}
    </div>
  );
}