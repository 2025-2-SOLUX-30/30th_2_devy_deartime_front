import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Plus, X, Camera } from "lucide-react"; 
import "../styles/AlbumDetail.css";
import bg from "../assets/background_nostar.png";

const AlbumDetail = () => {
  const { albumId } = useParams(); // URL에서 앨범 ID 추출
  const location = useLocation();
  const navigate = useNavigate();
  
  const photoInputRef = useRef(null); 
  const coverInputRef = useRef(null); 

  const albumData = location.state?.album;
  
  const [currentCover, setCurrentCover] = useState(albumData?.coverUrl); 
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  // 공통 인증 헤더
  const getAuthHeaders = () => ({
    "Authorization": `Bearer ${localStorage.getItem("accessToken")}`,
  });

  // 1. [조회] 앨범에 속한 사진 목록 불러오기
  const fetchAlbumPhotos = async () => {
    try {
      setLoading(true);
      // 명세서: GET /api/albums/{albumId}/photos
      const response = await fetch(`/api/albums/${albumId}/photos?sort=takenAt,desc&page=0&size=20`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      
      // 서버 응답 필드(photoId, imageUrl, caption)에 맞춰 상태 업데이트
      setAlbumPhotos(result.data || []);
    } catch (error) {
      console.error("앨범 사진 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (albumId) fetchAlbumPhotos();
  }, [albumId]);

  if (!albumData) {
    return <div className="error-msg">앨범 정보를 찾을 수 없습니다.</div>;
  }

  // 2. [커버 수정] 명세서의 앨범 수정 API가 있을 경우 연동 (현재는 UI 반영)
  const handleCoverEdit = (e) => {
    const file = e.target.files[0];
    if (file) {
      const newCoverUrl = URL.createObjectURL(file);
      setCurrentCover(newCoverUrl);
      // 팁: 필요시 여기서 POST /api/albums/{albumId}/title 처럼 커버 변경 API를 호출하세요.
    }
  };

  // 3. [사진 추가] 앨범에 사진 업로드 및 추가
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const token = localStorage.getItem("accessToken");

    // 각 파일을 순차적으로 업로드 (또는 병렬 처리)
    for (const file of files) {
      const formData = new FormData();
      formData.append("files", file); // 명세서 필드명

      const requestBlob = new Blob(
        [JSON.stringify({ caption: file.name.split('.')[0], albumId: parseInt(albumId) })],
        { type: "application/json" }
      );
      formData.append("request", requestBlob); // 명세서 필드명

      try {
        // 명세서: POST /api/albums/{albumId}/photos
        await fetch(`/api/albums/${albumId}/photos`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });
      } catch (error) {
        console.error("사진 추가 실패:", error);
      }
    }

    fetchAlbumPhotos(); // 업로드 후 목록 새로고침
    e.target.value = "";
  };

  // 4. [사진 제거] 앨범에서 사진 삭제
  const handleDeletePhoto = async (photoId) => {
    if (window.confirm("이 사진을 앨범에서 삭제하시겠습니까?")) {
      try {
        // 명세서: DELETE /api/albums/{albumId}/photos/{photoId}
        const response = await fetch(`/api/albums/${albumId}/photos/${photoId}`, {
          method: "DELETE",
          headers: getAuthHeaders()
        });

        if (response.ok) {
          setAlbumPhotos(prev => prev.filter(photo => photo.photoId !== photoId));
        }
      } catch (error) {
        alert("삭제에 실패했습니다.");
      }
    }
  };

  const handleBack = () => {
    navigate("/gallery", { 
      state: { 
        activeTab: 1, 
        updatedAlbum: { ...albumData, coverUrl: currentCover } 
      } 
    });
  };

  if (loading) return <div className="gallery-container" style={{color: 'white', padding: '50px'}}>앨범 사진을 불러오는 중...</div>;

  return (
    <div className="gallery-container" style={{ backgroundImage: `url(${bg})` }}>
      <div className="album-detail-container">
        {/* 상단 네비바 */}
        <div className="detail-top-nav">
          <button className="back-btn" onClick={handleBack}>
            &lt; ALBUM
          </button>
          <span className="album-nav-title">{albumData.title}</span>
        </div>

        {/* 상단 커버 영역 */}
        <div className="album-banner" onClick={() => coverInputRef.current.click()}>
          <img src={currentCover || 'https://via.placeholder.com/600x200'} alt="Album Cover" className="banner-img" />
          <div className="banner-overlay">
            <Camera size={32} color="white" />
            <span>커버 사진 변경</span>
          </div>
          <input 
            type="file" 
            ref={coverInputRef} 
            style={{ display: "none" }} 
            accept="image/*" 
            onChange={handleCoverEdit} 
          />
        </div>

        <div className="album-content-area">
          <div className="photo-grid1">
            {/* 사진 추가 버튼 */}
            <div className="grid-item add-btn-item" onClick={() => photoInputRef.current.click()}>
              <Plus size={40} color="#ffffff" strokeWidth={1} />
              <input 
                type="file" 
                ref={photoInputRef} 
                style={{ display: "none" }} 
                multiple 
                accept="image/*" 
                onChange={handlePhotoUpload} 
              />
            </div>

            {/* 사진 리스트 - 서버 데이터 매핑 (photoId, imageUrl) */}
            {albumPhotos.map((photo) => (
              <div key={photo.photoId} className="grid-item photo-item1">
                <img src={photo.imageUrl} alt={photo.caption || "album-content"} />
                <button className="delete-photo-btn" onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePhoto(photo.photoId);
                }}>
                  <X size={16} color="white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div> 
    </div>
  );
};

export default AlbumDetail;