import { useNavigate, useLocation } from "react-router-dom"; 
import '../styles/gallery.css';
import React, { useMemo, useState, useRef, useEffect } from "react";
import { Pen, Trash2, MoreVertical } from "lucide-react"; 
import bg from "../assets/background_nostar.png";
import AlbumCreateModal from "../components/AlbumCreateModal";

const Gallery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isLongPressActive = useRef(false);

  const tabs = ["RECORD", "ALBUM"];
  const [activeIndex, setActiveIndex] = useState(location.state?.activeTab ?? 0);

  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  const [menu, setMenu] = useState({ show: false, x: 0, y: 0, targetId: null, type: null, isCentered: false }); 
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 인증 헤더 가져오기
  const getAuthHeaders = (isMultipart = false) => {
    const headers = {
      "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
    };
    if (!isMultipart) headers["Content-Type"] = "application/json";
    return headers;
  };

  // 1. 목록 조회 (상대 경로 사용)
  const fetchAllData = async () => {
    try {
      setLoading(true);
      // 사진 목록 조회
      const photoRes = await fetch(`/api/photos?sort=takenAt,desc&page=0&size=20`, {
        headers: getAuthHeaders()
      });
      const photoData = await photoRes.json();

      // 앨범 목록 조회
      const albumRes = await fetch(`/api/albums`, {
        headers: getAuthHeaders()
      });
      const albumData = await albumRes.json();

      setPhotos(photoData.data || []);
      setAlbums(albumData.data || []);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const handleClick = () => setMenu(prev => ({ ...prev, show: false }));
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // 2. 사진 업로드
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("files", file); // 필드명 'files'

    const requestBlob = new Blob(
      [JSON.stringify({ caption: file.name.split('.')[0], albumId: null })],
      { type: "application/json" }
    );
    formData.append("request", requestBlob); // 필드명 'request'

    try {
      const response = await fetch(`/api/photos`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("accessToken")}` },
        body: formData,
      });

      if (response.ok) {
        fetchAllData();
        alert("사진 업로드 성공!");
      }
    } catch (error) {
      alert("업로드 에러 발생");
    } finally {
      e.target.value = '';
    }
  };

  // 3. 사진/앨범 삭제
  const handleDelete = async () => {
    const url = menu.type === 'photo' 
      ? `/api/photos/${menu.targetId}` 
      : `/api/albums/${menu.targetId}`;

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (response.ok) {
        if (menu.type === 'photo') setPhotos(prev => prev.filter(p => p.photoId !== menu.targetId));
        else setAlbums(prev => prev.filter(a => a.albumId !== menu.targetId));
      }
    } catch (error) {
      alert("삭제 실패");
    }
    setMenu(prev => ({ ...prev, show: false }));
  };

  // 4. 이름/캡션 수정 (POST 방식)
  const handleEditComplete = async (e, id) => {
    if (e.key === 'Enter') {
      const newValue = e.target.value;
      const isPhoto = activeIndex === 0;
      const url = isPhoto ? `/api/photos/${id}/caption` : `/api/albums/${id}/title`;
      const body = isPhoto ? { caption: newValue } : { title: newValue };

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(body)
        });

        if (response.ok) {
          if (isPhoto) setPhotos(prev => prev.map(p => p.photoId === id ? { ...p, caption: newValue } : p));
          else setAlbums(prev => prev.map(a => a.albumId === id ? { ...a, title: newValue } : a));
        }
      } catch (error) {
        alert("수정 실패");
      }
      setEditingId(null);
    } else if (e.key === 'Escape') setEditingId(null);
  };

  const handleCreateAlbum = async (albumData) => {
    try {
      const response = await fetch(`/api/albums`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: albumData.title })
      });
      if (response.ok) {
        fetchAllData();
        setIsModalOpen(false);
      }
    } catch (error) {
      alert("앨범 생성 실패");
    }
  };

  const handleItemClick = (e, album = null) => {
    if (isLongPressActive.current) {
      e.stopPropagation();
      isLongPressActive.current = false;
      return;
    }
    if (album) navigate(`/album/${album.albumId}`, { state: { album } });
  };

  const groupedPhotos = useMemo(() => {
    return photos.reduce((acc, photo) => {
      const date = (photo.takenAt || photo.uploadedAt)?.split('T')[0].replace(/-/g, '.') || "Unknown";
      if (!acc[date]) acc[date] = [];
      acc[date].push(photo);
      return acc;
    }, {});
  }, [photos]);

  if (loading) return <div className="gallery-container" style={{color: 'white', padding: '50px'}}>데이터를 불러오는 중...</div>;

  return (
    <div className="gallery-container" style={{ backgroundImage: `url(${bg})` }}>
      <AlbumCreateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreate={handleCreateAlbum} />
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileUpload} />
      
      {(menu.show || editingId !== null) && <div className="context-menu-overlay" />}

      {menu.show && (
        <div className={`custom-context-menu ${menu.isCentered ? 'centered' : ''}`} style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="menu-item" onClick={() => {setEditingId(menu.targetId); setMenu(prev=>({...prev, show:false}));}}>
            <Pen size={15} color="white" />
            <span>{menu.type === 'photo' ? '캡션 수정' : '이름 수정'}</span>
          </div>  
          <div className="menu-divider" />
          <div className="menu-item delete" onClick={handleDelete}>
            <Trash2 size={15} color="#FF4D4D" />
            <span>삭제</span>
          </div>
        </div>
      )}

      <div className="tc-topbar">
        <div className="gallery-topnav">
          {tabs.map((tab, index) => (
            <span key={tab} onClick={() => setActiveIndex(index)} className={`gallery-tab ${index === activeIndex ? 'active' : ''}`}>
              {tab}
              <span className="gallery-tab-underline" />
            </span>
          ))}
        </div>
        <div className="tc-topbar-right">
          <button className="tc-create-btn" onClick={() => activeIndex === 0 ? fileInputRef.current.click() : setIsModalOpen(true)}>
            {activeIndex === 0 ? '업로드' : '생성'}
          </button>
        </div>
      </div>

      <div className="gallery-content-wrapper">
        {activeIndex === 0 ? (
          Object.keys(groupedPhotos).map((date) => (
            <section key={date} className="date-group">
              <h2 className="date-title">{date}</h2>
              <div className="photo-grid">
                {groupedPhotos[date].map((photo) => {
                  const isSpotlight = (menu.show && menu.targetId === photo.photoId) || (editingId === photo.photoId);
                  return (
                    <div key={photo.photoId} className={`photo-item ${isSpotlight ? 'spotlight' : ''}`} onContextMenu={(e) => {e.preventDefault(); const rect=e.currentTarget.getBoundingClientRect(); setMenu({show:true, x:rect.left+rect.width/2, y:rect.top+rect.height/2, targetId:photo.photoId, type:'photo', isCentered:true});}}>
                      <div className="img-box">
                        <img src={photo.imageUrl} alt={photo.caption} />
                      </div>
                      {editingId === photo.photoId ? (
                        <input className="edit-title-input" defaultValue={photo.caption} autoFocus onKeyDown={(e) => handleEditComplete(e, photo.photoId)} onBlur={() => setEditingId(null)} />
                      ) : (
                        <p className="photo-title">{photo.caption}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="album-section">
            <div className="album-grid">
              {albums.map((album) => {
                const isSpotlight = (menu.show && menu.targetId === album.albumId) || (editingId === album.albumId);
                return (
                  <div key={album.albumId} className={`album-item ${isSpotlight ? 'spotlight' : ''}`} onClick={(e) => handleItemClick(e, album)}>
                    <div className="album-img-box">
                      <img src={album.coverUrl || 'https://via.placeholder.com/300'} alt={album.title} />
                    </div>
                    <div className="album-info">
                      <div className="album-info-top">
                        {editingId === album.albumId ? (
                          <input className="edit-title-input" defaultValue={album.title} autoFocus onKeyDown={(e) => handleEditComplete(e, album.albumId)} onBlur={() => setEditingId(null)} onClick={(e)=>e.stopPropagation()} />
                        ) : (
                          <h3>{album.title}</h3>
                        )}
                        <button className="album-menu-trigger" onClick={(e) => {e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setMenu({show:true, x:rect.left-160, y:rect.bottom+10, targetId:album.albumId, type:'album', isCentered:false});}}>
                          <MoreVertical size={24} color="white" />
                        </button>
                      </div>
                      <p>항목 {album.count || 0} 개</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;