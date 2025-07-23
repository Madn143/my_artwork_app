import { useEffect, useState, useRef } from "react";
import {
  DataTable,
  DataTableSelectionChangeEvent,
  DataTablePageEvent
} from "primereact/datatable";
import { Column } from "primereact/column";
import { Artwork } from "./types/artwork";
import { getArtworksByPage } from "./services/api";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./App.css";

function App() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedRows, setSelectedRows] = useState<{ [id: string]: Artwork }>({});
  const rowsPerPage = 10;
  const selectedPageRef = useRef<{ [page: number]: string[] }>({});

  useEffect(() => {
    loadPage(page);
  }, [page]);

  const loadPage = async (pageIndex: number) => {
    setLoading(true);
    const response = await getArtworksByPage(pageIndex + 1);
    setArtworks(response.data);
    setTotalRecords(response.total);
    setLoading(false);
  };

  const onPageChange = (event: DataTablePageEvent) => {
    setPage(event.page);
  };

  const onSelectionChange = (e: DataTableSelectionChangeEvent) => {
    const newSelected: { [id: string]: Artwork } = { ...selectedRows };
    const selectedArtworks: Artwork[] = e.value || [];

    const currentPageSelectedIds = selectedArtworks.map((art) => art.id.toString());
    selectedPageRef.current[page] = currentPageSelectedIds;

    artworks.forEach((art) => {
      const id = art.id.toString();
      if (currentPageSelectedIds.includes(id)) {
        newSelected[id] = art;
      } else {
        delete newSelected[id];
      }
    });

    setSelectedRows(newSelected);
  };

  const selectedArray = Object.values(selectedRows);

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-indigo-700 mb-6">
          🎨 Art Explorer
        </h1>

        <Card className="shadow-2xl rounded-2xl">
          <DataTable
            value={artworks}
            paginator
            rows={rowsPerPage}
            totalRecords={totalRecords}
            lazy
            loading={loading}
            onPage={onPageChange}
            first={page * rowsPerPage}
            selection={Object.values(selectedRows).filter((row) => selectedPageRef.current[page]?.includes(row.id.toString()))}
            onSelectionChange={onSelectionChange}
            selectionMode="checkbox"
            dataKey="id"
            className="p-datatable-sm p-datatable-gridlines rounded-xl overflow-hidden"
          >
            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
            <Column field="title" header="Title" sortable></Column>
            <Column field="place_of_origin" header="Origin" sortable></Column>
            <Column field="artist_display" header="Artist" sortable></Column>
            <Column field="inscriptions" header="Inscriptions"></Column>
            <Column field="date_start" header="Start Date" sortable></Column>
            <Column field="date_end" header="End Date" sortable></Column>
          </DataTable>
        </Card>

        {selectedArray.length > 0 && (
          <div className="mt-8">
            <Card className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-indigo-700 mb-2">
                Selected Artworks ({selectedArray.length})
              </h2>
              <ul className="space-y-1">
                {selectedArray.map((art) => (
                  <li key={art.id} className="text-gray-700">
                    <strong>{art.title}</strong> — {art.artist_display || 'Unknown Artist'}
                  </li>
                ))}
              </ul>
              <Button
                label="Clear Selection"
                icon="pi pi-times"
                className="mt-4 p-button-danger"
                onClick={() => {
                  setSelectedRows({});
                  selectedPageRef.current = {};
                }}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
