import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

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
      if (sortField && (sortOrder === 1 || sortOrder === -1)) { // Explicitly check for 1 or -1
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
            loading={loading}
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
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
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