import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { OverlayPanel } from 'primereact/overlaypanel';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';

import type {
  DataTableStateEvent,
  DataTableSortEvent
} from 'primereact/datatable';

interface Artwork {
  id: number;
  title: string;
  place_of_origin: string;
  artist_display: string;
  inscriptions: string | null;
  date_start: number;
  date_end: number;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  total_pages: number;
  current_page: number;
  next_url: string | null;
  prev_url: string | null;
}

interface ApiResponse {
  data: Artwork[];
  pagination: Pagination;
}

interface CustomDataTableSelectAllEvent {
    originalEvent: React.SyntheticEvent;
    checked: boolean;
}

function App() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [first, setFirst] = useState<number>(0);
  const [rows, setRows] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<1 | -1 | 0 | null | undefined>(null);

  const [selectedArtworks, setSelectedArtworks] = useState<Artwork[]>([]);
  const [allSelectedArtworks, setAllSelectedArtworks] = useState<Artwork[]>([]);

  // Bulk Selection States
  const op = useRef<OverlayPanel>(null);
  const [numRowsToSelect, setNumRowsToSelect] = useState<number | null>(null);
  const [bulkSelecting, setBulkSelecting] = useState<boolean>(false);

  const fetchArtworks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `https://api.artic.edu/api/v1/artworks?page=${currentPage}&limit=${rows}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiResponse: ApiResponse = await response.json();
      let fetchedArtworks = apiResponse.data;

      // CLIENT-SIDE SORTING: Apply sorting to the current page's data
      if (sortField && (sortOrder === 1 || sortOrder === -1)) {
        fetchedArtworks = [...fetchedArtworks].sort((a, b) => {
          const valA = a[sortField as keyof Artwork];
          const valB = b[sortField as keyof Artwork];

          if (valA === null && valB === null) return 0;
          if (valA === null) return sortOrder === 1 ? 1 : -1;
          if (valB === null) return sortOrder === 1 ? -1 : 1;

          if (typeof valA === 'string' && typeof valB === 'string') {
            return sortOrder * valA.localeCompare(valB);
          }
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortOrder * (valA - valB);
          }
          return 0;
        });
      }

      setArtworks(fetchedArtworks);
      setTotalRecords(apiResponse.pagination.total);

      // Re-evaluate selections for the current page based on allSelectedArtworks
      const currentlySelectedOnPage = fetchedArtworks.filter(artwork =>
          allSelectedArtworks.some(selected => selected.id === artwork.id)
      );
      setSelectedArtworks(currentlySelectedOnPage);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, rows, sortField, sortOrder, allSelectedArtworks]);

  useEffect(() => {
    fetchArtworks();
  }, [fetchArtworks]);

  const onPage = (event: DataTableStateEvent) => {
    setFirst(event.first);
    setRows(event.rows);
    const newPage = (event.page ?? 0) + 1;
    setCurrentPage(newPage);
  };

  const onSort = (event: DataTableSortEvent) => {
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
    fetchArtworks();
  };

  const onSelectionChange = (e: { value: Artwork[] }) => {
    const currentSelectedOnPage = e.value;
    setSelectedArtworks(currentSelectedOnPage);

    setAllSelectedArtworks((prevAllSelected) => {
      const newAllSelected = new Set(prevAllSelected.map(item => item.id));

      currentSelectedOnPage.forEach(artwork => {
        newAllSelected.add(artwork.id);
      });

      // Remove items from allSelectedArtworks that were deselected on the current page
      artworks.forEach(artwork => {
        if (!currentSelectedOnPage.some(item => item.id === artwork.id)) {
          newAllSelected.delete(artwork.id);
        }
      });

      return Array.from(newAllSelected).map(id =>
          artworks.find(artwork => artwork.id === id) || prevAllSelected.find(artwork => artwork.id === id)
      ).filter(Boolean) as Artwork[];
    });
  };

  const onSelectAllChange = (event: CustomDataTableSelectAllEvent) => {
    let newSelectedArtworks: Artwork[];
    if (event.checked) {
      newSelectedArtworks = artworks;
    } else {
      newSelectedArtworks = [];
    }
    setSelectedArtworks(newSelectedArtworks);

    setAllSelectedArtworks((prevAllSelected) => {
      const newAllSelected = new Set(prevAllSelected.map(item => item.id));

      if (event.checked) {
        artworks.forEach(artwork => newAllSelected.add(artwork.id));
      } else {
        artworks.forEach(artwork => newAllSelected.delete(artwork.id));
      }
      return Array.from(newAllSelected).map(id =>
          artworks.find(artwork => artwork.id === id) || prevAllSelected.find(artwork => artwork.id === id)
      ).filter(Boolean) as Artwork[];
    });
  };

  // Bulk Selection Logic
  const handleBulkSelect = async () => {
    if (numRowsToSelect === null || numRowsToSelect <= 0) {
      return;
    }

    setBulkSelecting(true); // Start bulk selecting loading state
    op.current?.hide(); // Hide the overlay immediately

    let itemsToFetchCount = Math.min(numRowsToSelect, totalRecords); // Don't try to select more than total available

    let newFetchedArtworks: Artwork[] = [];
    let currentPageForFetch = 1;

    try {
        // Fetch pages sequentially until enough items are gathered or all pages are fetched
        while (newFetchedArtworks.length < itemsToFetchCount && currentPageForFetch <= totalRecords / rows + 1) {
            const url = `https://api.artic.edu/api/v1/artworks?page=${currentPageForFetch}&limit=${rows}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const apiResponse: ApiResponse = await response.json();
            newFetchedArtworks.push(...apiResponse.data);
            currentPageForFetch++;
        }

        // Take only the requested number of items
        const selectedItems = newFetchedArtworks.slice(0, itemsToFetchCount);

        setAllSelectedArtworks((prevAllSelected) => {
            const newAllSelected = new Set(prevAllSelected.map(item => item.id));
            selectedItems.forEach(artwork => newAllSelected.add(artwork.id));
            return Array.from(newAllSelected).map(id =>
                // Try to find the artwork from selectedItems first, then prevAllSelected if not found
                selectedItems.find(item => item.id === id) || prevAllSelected.find(item => item.id === id)
            ).filter(Boolean) as Artwork[];
        });

        // Update selectedArtworks for the current visible page
        const currentlySelectedOnPage = artworks.filter(artwork =>
            selectedItems.some(selected => selected.id === artwork.id)
        );
        setSelectedArtworks(currentlySelectedOnPage);

    } catch (err: any) {
        setError(`Failed to bulk select: ${err.message}`);
    } finally {
        setBulkSelecting(false); // End bulk selecting loading state
        setNumRowsToSelect(null); // Clear input
    }
  };


  const headerCheckboxTemplate = (options: any) => {
    return (
      <div className="p-checkbox-wrapper"
           style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        {options.children} {/* This is the default PrimeReact checkbox */}
        <Button
          icon="pi pi-angle-down" // Changed icon to a down arrow for "more options"
          className="p-button-sm bulk-select-trigger" // Use the class for hover effect
          onClick={(e) => op.current?.toggle(e)}
          aria-haspopup
          aria-controls="overlay_panel"
          style={{
              width: '24px', // Fixed width for a small button
              height: '24px', // Fixed height for a small button
              padding: '0', // Remove padding
              backgroundColor: '#6c757d', /* Ash color */
              color: '#ffffff', /* White icon */
              border: '1px solid #6c757d',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              transition: 'background-color 0.2s, border-color 0.2s'
          }}
          onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#5a6268';
              e.currentTarget.style.borderColor = '#5a6268';
          }}
          onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#6c757d';
              e.currentTarget.style.borderColor = '#6c757d';
          }}
        />
        <OverlayPanel ref={op} appendTo={document.body} id="overlay_panel"
                      style={{
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          border: 'none',
                          backgroundColor: '#ffffff'
                      }}>
          <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h5 style={{ margin: '0', fontSize: '1.1em', color: '#333' }}>Bulk Select</h5>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label htmlFor="num-rows-select" style={{ minWidth: '80px', color: '#555' }}>Select first:</label>
              <InputNumber
                id="num-rows-select"
                value={numRowsToSelect}
                onValueChange={(e) => setNumRowsToSelect(e.value ?? null)}
                mode="decimal"
                showButtons
                min={0}
                max={totalRecords}
                className="p-inputtext-sm"
                inputStyle={{ width: '100px' }}
                placeholder="Number of rows"
              />
            </div>
            {bulkSelecting ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <ProgressSpinner style={{ width: '25px', height: '25px', stroke: '#007ad9' }} strokeWidth="8" animationDuration=".5s" />
                    <small style={{ color: '#555' }}>Selecting...</small>
                </div>
            ) : (
                <Button
                  label="Apply Selection"
                  icon="pi pi-check"
                  onClick={handleBulkSelect}
                  className="p-button-sm"
                  style={{
                      backgroundColor: '#6c757d', /* Ash color */
                      color: '#ffffff',
                      border: '1px solid #6c757d',
                      padding: '10px 15px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      transition: 'background-color 0.2s, border-color 0.2s',
                      width: '100%'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#495057', e.currentTarget.style.borderColor = '#495057')} /* Darker ash on hover */
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#6c757d', e.currentTarget.style.borderColor = '#6c757d')}
                  disabled={numRowsToSelect === null || numRowsToSelect <= 0}
                />
            )}
            <small style={{ color: '#666', fontSize: '0.85em', textAlign: 'center' }}>
                Note: Selecting a large number of rows may take time as data is fetched from multiple pages.
            </small>
          </div>
        </OverlayPanel>
      </div>
    );
  };


  return (
    <div className="App">
      <h1>Artworks Data Table</h1>

      {error && <p style={{ color: 'red', marginBottom: '20px' }}>Error: {error}</p>}

      {!error && (
        <div className="card">

          {allSelectedArtworks.length > 0 && (
            <div style={{
                marginTop: '20px',
                padding: '15px',
                border: '1px solid #007ad9',
                borderRadius: '5px',
                marginBottom: '20px',
                backgroundColor: '#e3f2fd'
            }}>
              <h3>Selected Artworks: {allSelectedArtworks.length}</h3>
              <button
                onClick={() => {
                  setAllSelectedArtworks([]);
                  setSelectedArtworks([]);
                }}
                style={{
                  padding: '8px 15px',
                  cursor: 'pointer',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  marginTop: '10px'
                }}
              >
                Clear All Selections
              </button>
            </div>
          )}

          <DataTable
            value={artworks}
            tableStyle={{ minWidth: '50rem' }}
            dataKey="id"
            className="my-datatable"

            paginator
            rows={rows}
            totalRecords={totalRecords}
            first={first}
            onPage={onPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            lazy
            loading={loading || bulkSelecting}
            responsiveLayout="scroll"

            selectionMode="multiple"
            selection={selectedArtworks}
            onSelectionChange={onSelectionChange}
            onSelectAllChange={onSelectAllChange}

            sortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
            multiSortMeta={[]}
          >
            {/* Using a custom header for the selection column */}
            <Column selectionMode="multiple" header={headerCheckboxTemplate} headerStyle={{ width: '3rem' }}></Column>
            <Column field="title" header="Title" sortable></Column>
            <Column field="place_of_origin" header="Place of Origin" sortable></Column>
            <Column field="artist_display" header="Artist Display" sortable></Column>
            <Column field="inscriptions" header="Inscriptions" sortable></Column>
            <Column field="date_start" header="Date Start" sortable></Column>
            <Column field="date_end" header="Date End" sortable></Column>
          </DataTable>

          {!loading && !error && artworks.length === 0 && (
            <p>No artworks found.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;