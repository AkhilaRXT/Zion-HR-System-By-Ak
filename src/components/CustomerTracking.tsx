import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, Customer, Employee, AppSettings } from '../types';
import { db, auth } from '../lib/firebase';
import { DataStore } from '../lib/dataStore';
import { collection, addDoc, setDoc, updateDoc, doc, onSnapshot, query, serverTimestamp, getDoc, where } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, Image as ImageIcon, CheckCircle, Clock } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Notification, { NotificationType } from './Notification';
import { fileToBase64 } from '../lib/fileUtils';

// Fix for Leaflet default marker icons not loading in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const storage = getStorage();

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// A component to automatically fit bounds to markers (optional, or just set initial view)
function MapBounds({ customers }: { customers: Customer[] }) {
  const map = useMap();
  useEffect(() => {
    if (customers.length > 0) {
      const bounds = L.latLngBounds(customers.filter(c => c.location?.lat && c.location?.lng).map(c => [c.location.lat, c.location.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [customers, map]);
  return null;
}

interface CustomerTrackingProps {
  session: Session;
  employees: Employee[];
  settings: AppSettings;
}

export default function CustomerTracking({ session, employees, settings }: CustomerTrackingProps) {
  const isMasterAdmin = session.email?.toLowerCase() === 'zioncommercialcreditampara@gmail.com' || session.username?.toLowerCase() === 'admin';
  const canViewMap = isMasterAdmin || (session.isAdmin && session.permissions?.includes('customerTracking'));
  const canEdit = isMasterAdmin || (session.isAdmin && session.permissions?.includes('customerTrackingEdit'));
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlaceModal, setShowPlaceModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all');
  const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({ message, type });
  };

  useEffect(() => {
    // If the user has view map permission, maybe fetch ALL. 
    // If employee only, fetch THEIR submissions maybe, or even ALL if it's open.
    // The rules say "Any authenticated user can read".
    const q = query(collection(db, 'fileChunks'), where('docType', '==', 'customer'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      // Sort locally to prevent Firestore caching assertion bug with optimistic updates
      data.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
      setCustomers(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      showNotification('Failed to load customers', 'error');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePlaceCustomerClick = () => {
    setShowPlaceModal(true);
  };

  const filteredCustomers = customers.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customer Tracking</h2>
          <p className="text-gray-500 text-sm mt-1">Manage and track customer locations</p>
        </div>
        <button
          onClick={handlePlaceCustomerClick}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm font-medium"
        >
          <MapPin size={20} />
          <span>Place a Customer</span>
        </button>
      </div>

      {!canViewMap ? (
         <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-blue-50 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Customer Placement</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Click the "Place a Customer" button above to record a new customer location using your device's GPS.
            </p>
            
            <div className="mt-8">
              <h4 className="text-sm font-medium text-gray-700 text-left mb-4 uppercase tracking-wider">Your Recent Submissions</h4>
              <div className="space-y-3">
                {customers.filter(c => c.placedBy === session.empId).slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-white rounded shadow-sm">
                         <MapPin size={16} className={c.status === 'verified' ? 'text-green-500' : 'text-orange-500'} />
                       </div>
                       <div>
                         <p className="font-medium text-gray-900">{c.customerName}</p>
                         <p className="text-xs text-gray-500">{new Date(c.placedAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}</p>
                       </div>
                    </div>
                    <div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${c.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {c.status === 'verified' ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
                {customers.filter(c => c.placedBy === session.empId).length === 0 && (
                  <p className="text-sm text-gray-500 italic text-left">No customers placed yet.</p>
                )}
              </div>
            </div>
         </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
          {/* Map Controls */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {(['all', 'pending', 'verified'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            <div className="text-sm text-gray-600 font-medium flex items-center gap-4">
              <span>All: <strong className="text-gray-900">{customers.length}</strong></span>
              <span className="text-green-600">Verified: <strong>{customers.filter(c => c.status === 'verified').length}</strong></span>
              <span className="text-orange-600">Pending: <strong>{customers.filter(c => c.status === 'pending').length}</strong></span>
            </div>
          </div>
          
          {/* Map Area */}
          <div className="flex-1 relative z-0">
            {loading ? (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              </div>
            ) : (
              <MapContainer 
                center={[7.292926, 81.686263]} 
                zoom={15} 
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBounds customers={filteredCustomers} />
                {filteredCustomers.filter(c => c.location?.lat && c.location?.lng).map(customer => (
                  <Marker 
                    key={customer.id} 
                    position={[customer.location.lat, customer.location.lng]}
                    icon={customer.status === 'verified' ? greenIcon : redIcon}
                  >
                    <Popup className="custom-popup">
                       <CustomerInfoPopup customer={customer} canEdit={canEdit} session={session} showNotification={showNotification} />
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPlaceModal && (
          <PlaceCustomerModal 
            onClose={() => setShowPlaceModal(false)} 
            session={session} 
            showNotification={showNotification}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomerInfoPopup({ customer, canEdit, session, showNotification }: { customer: Customer; canEdit?: boolean; session: Session; showNotification: (msg: string, type?: NotificationType) => void }) {
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (window.confirm(`Confirm verification of ${customer.customerName}'s home location?`)) {
      setIsVerifying(true);
      try {
        await updateDoc(doc(db, 'fileChunks', customer.id), {
          verified: true,
          verifiedBy: session.empId,
          verifiedByName: session.name,
          verifiedAt: new Date().toISOString(),
          status: 'verified'
        });
        showNotification("Customer verified successfully.");
      } catch (err: any) {
         showNotification(err.message || 'Error verifying customer', 'error');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <div className="p-1 min-w-[200px]">
      <h3 className="font-bold text-gray-900 text-base mb-1">{customer.customerName}</h3>
      <div className="space-y-1.5 mb-3 text-sm">
        <p className="flex items-center text-gray-600 gap-1.5"><MapPin size={12}/> {customer.placedByName}</p>
        <p className="flex items-center text-gray-600 gap-1.5"><Clock size={12}/> {new Date(customer.placedAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo', dateStyle: 'short', timeStyle: 'short' })}</p>
        <div className="flex items-center mt-2">
           <span className={`px-2 py-0.5 rounded text-xs font-semibold ${customer.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
             {customer.status.toUpperCase()}
           </span>
        </div>
      </div>
      
      {customer.housePhotoURL && (
        <div className="mb-3">
          <a href={customer.housePhotoURL} target="_blank" rel="noreferrer">
            <img src={customer.housePhotoURL} alt="House" className="w-full h-24 object-cover rounded-md border border-gray-200" />
          </a>
        </div>
      )}

      {canEdit && customer.status === 'pending' && (
        <button 
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full flex items-center justify-center gap-1.5 bg-brand-secondary text-white py-1.5 px-3 rounded hover:bg-brand-secondary/90 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {isVerifying ? 'Verifying...' : <><CheckCircle size={14}/> Verify Customer</>}
        </button>
      )}
    </div>
  );
}

function PlaceCustomerModal({ onClose, session, showNotification }: { onClose: () => void; session: Session; showNotification: (msg: string, type?: NotificationType) => void }) {
  const [customerName, setCustomerName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setIsGettingLocation(false);
      },
      (err) => {
        setLocationError('Location access denied. Please enable location permissions and try again.');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      showNotification('Location is required to place a customer.', 'error');
      return;
    }
    if (!customerName.trim()) {
      showNotification('Customer Name is required.', 'error');
      return;
    }
    if (!session.empId) {
      showNotification('Session error: employee ID missing. Please log out and back in.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
       console.log('Ensuring auth before upload or write...');
       await DataStore.ensureAuth();
       
       if (!auth.currentUser) {
         throw new Error("You are not authenticated with the server. Please log out and log back in.");
       }

       let photoUrl = null;
       if (file) {
         console.log('Uploading photo...');
         try {
           photoUrl = await fileToBase64(file);
           console.log('Photo uploaded successfully');
         } catch (uploadErr: any) {
           console.error('Photo upload failed:', uploadErr);
           throw new Error("Failed to upload photo: " + uploadErr.message);
         }
       }

       console.log('Attempting to save customer. Auth user:', auth.currentUser?.uid, 'Current user:', session.empId);
       console.log('Writing to Firestore (customers collection)...');
       try {
         await addDoc(collection(db, 'fileChunks'), {
            docType: 'customer',
            customerName: customerName.trim(),
            location: { lat: location.lat, lng: location.lng },
            housePhotoURL: photoUrl || null,
            placedBy: session.empId || '',
            placedByName: session.name || '',
            placedAt: new Date().toISOString(),
            verified: false,
            verifiedBy: null,
            verifiedAt: null,
            status: 'pending'
         });
       } catch (fsErr: any) {
         console.error('Firestore addDoc failed:', fsErr);
         throw new Error("Failed to save to database (Firestore): " + fsErr.message);
       }

       showNotification("Customer placed successfully. Awaiting admin verification.");
       onClose();
    } catch (err: any) {
       console.error("Error saving customer:", err);
       showNotification("Failed to save customer: " + err.message, 'error');
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="text-brand-primary" />
            Place a Customer
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>

        <div className="p-6">
          <form id="place-customer-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer Name *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
                placeholder="Enter customer name..."
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex justify-between">
                <span>House Photo</span>
                <span className="text-gray-400 font-normal">Optional</span>
              </label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon size={20} className="text-gray-400 mb-2" />
                  <p className="text-xs text-gray-500">{file ? file.name : "Click to select a photo"}</p>
                </div>
                <input 
                  type="file" 
                  accept="image/*"
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="card p-4 bg-gray-50 border border-gray-200 rounded-xl relative overflow-hidden">
               <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                 <MapPin size={16} className="text-brand-primary"/> Current Location
               </h4>
               {isGettingLocation ? (
                 <div className="flex flex-col items-center justify-center py-4 text-gray-500 gap-2">
                   <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary" />
                   <p className="text-sm font-medium">Getting GPS lock...</p>
                 </div>
               ) : locationError ? (
                 <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{locationError}</p>
               ) : location ? (
                 <div className="h-32 w-full rounded-lg overflow-hidden border border-gray-200 relative z-0">
                    <MapContainer 
                      center={[location.lat, location.lng]} 
                      zoom={15} 
                      style={{ height: '100%', width: '100%', zIndex: 0 }}
                      dragging={false}
                      zoomControl={false}
                      scrollWheelZoom={false}
                      doubleClickZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[location.lat, location.lng]} />
                    </MapContainer>
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono shadow text-gray-700 pointer-events-none z-[1000]">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </div>
                 </div>
               ) : null}
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="place-customer-form"
            disabled={isSubmitting || isGettingLocation || !!locationError}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
