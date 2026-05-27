import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const BASE_URL = 'http://110.172.28.19:8080';
const DEFAULT_PAGE = 'landing';

function App() {
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [products, setProducts] = useState([]);
  const [landingProducts, setLandingProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState(null);
  const [auth, setAuth] = useState(() => ({
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
    username: localStorage.getItem('username'),
    role: localStorage.getItem('role') || 'USER'
  }));
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    email: '',
    phone: '',
    fullName: ''
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminCreate, setAdminCreate] = useState({
    name: '',
    description: '',
    linkImg: '',
    variants: [
      { color: '', size: '', price: '', quantity: '' }
    ]
  });
  const [adminUpdate, setAdminUpdate] = useState({ id: '', name: '', description: '', linkImg: '' });
  const [adminDeleteId, setAdminDeleteId] = useState('');

  const isAdmin = auth?.role === 'ADMIN';

  const decodeJwtPayload = (token) => {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const extractRoleFromToken = (token) => {
    const payload = decodeJwtPayload(token);
    if (!payload) return 'USER';

    const directRole = payload.role || payload.roles || payload.authorities;
    if (typeof directRole === 'string') {
      return directRole.replace('ROLE_', '');
    }

    if (Array.isArray(directRole)) {
      const normalized = directRole.map((r) => String(r).replace('ROLE_', ''));
      return normalized.includes('ADMIN') ? 'ADMIN' : (normalized[0] || 'USER');
    }

    return 'USER';
  };

  const teamMembers = useMemo(
    () => [
      { name: 'Nguyen Huu Chuong', role: 'Backend - Java Spring Boot' },
      { name: 'Nguyen Anh Khoa', role: 'Frontend - UI/UX' },
      { name: 'Nguyen Thanh Nghia', role: 'Frontend - API Integration' },
      { name: 'Nguyen Hoang Khoi', role: 'Frontend - Layout & Motion' }
    ],
    []
  );

  const metrics = useMemo(
    () => [
      { label: 'Nhóm số', value: '10' },
      { label: 'Thành viên', value: '4' },
      { label: 'Backend', value: 'Java Spring Boot' },
      { label: 'Frontend', value: 'React + Vite' }
    ],
    []
  );

  const navigate = (nextPage) => {
    window.location.hash = nextPage;
  };

  const callApi = async (path, options = {}, withAuth = false) => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {})
    };

    if (withAuth && auth?.accessToken) {
      headers.Authorization = `Bearer ${auth.accessToken}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return data;
  };

  const fetchProductsFromBackend = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await callApi('/api/products?page=0&size=10&sort=id,desc');
      setProducts(data?.data?.content || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLandingProducts = async () => {
    try {
      const data = await callApi('/api/products?page=0&size=4&sort=id,desc');
      setLandingProducts(data?.data?.content || []);
    } catch {
      setLandingProducts([]);
    }
  };

  useEffect(() => {
    const syncPage = () => {
      const hash = window.location.hash.replace('#', '').trim();
      setPage(hash || DEFAULT_PAGE);
    };

    syncPage();
    window.addEventListener('hashchange', syncPage);
    return () => window.removeEventListener('hashchange', syncPage);
  }, []);

  useEffect(() => {
    if (auth?.accessToken) {
      const roleFromToken = extractRoleFromToken(auth.accessToken);
      if (roleFromToken !== auth.role) {
        setAuth((prev) => ({ ...prev, role: roleFromToken }));
        localStorage.setItem('role', roleFromToken);
      }
    }

    if (auth?.username && !user) {
      setUser({ name: auth.username, role: auth.role || 'USER' });
    }
  }, [auth, user]);

  useEffect(() => {
    if (page === 'shop') {
      fetchProductsFromBackend();
    }
    if (page === 'landing') {
      fetchLandingProducts();
    }
  }, [page]);

  useEffect(() => {
    const elements = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.2 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [page]);

  const handleLogin = async () => {
    try {
      setNotice(null);
      const res = await callApi('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password
        })
      });

      const accessToken = res?.data?.data?.accessToken;
      const refreshToken = res?.data?.data?.refreshToken;
      const role = extractRoleFromToken(accessToken);

      if (!accessToken) {
        const message = res?.message || 'Đăng nhập thất bại';
        setNotice({ type: 'error', message });
        return;
      }

      const nextAuth = {
        accessToken,
        refreshToken,
        username: loginForm.username,
        role
      };

      setAuth(nextAuth);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken || '');
      localStorage.setItem('username', loginForm.username);
      localStorage.setItem('role', role);
      setUser({ name: loginForm.username, role });
      setNotice({ type: 'success', message: res?.message || 'Đăng nhập thành công' });
      // tự tắt sau 3 giây
      setTimeout(() => {
        setNotice(null);
      }, 3000);
      navigate('shop');
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleRegister = async () => {
    try {
      setNotice(null);
      const res = await callApi('/api/users', {
        method: 'POST',
        body: JSON.stringify(registerForm)
      });
      setNotice({ type: 'success', message: res?.message || 'Tạo tài khoản thành công' });
      // tự tắt sau 3 giây
      setTimeout(() => {
        setNotice(null);
      }, 3000);
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuth({ accessToken: null, refreshToken: null, username: null, role: 'USER' });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('landing');
  };

  const handleAddToCart = (product) => {
    setCart((prev) => [...prev, product]);
    setNotice({ type: 'success', message: `Đã thêm ${product.name} vào giỏ hàng` });
  };

  const handleViewDetail = async (id) => {
    try {
      setDetailLoading(true);
      const res = await callApi(`/api/products/getDetail/${id}`);
      setSelectedProduct(res?.data || null);
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateProduct = async () => {
    try {
      setNotice(null);
      const cleanedVariants = adminCreate.variants
        .filter((variant) => variant.color || variant.size)
        .map((variant) => ({
          color: variant.color,
          size: variant.size,
          price: Number(variant.price),
          quantity: Number(variant.quantity)
        }));

      const payload = {
        name: adminCreate.name,
        description: adminCreate.description,
        linkImg: adminCreate.linkImg,
        variants: cleanedVariants
      };

      const res = await callApi('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, true);
      setNotice({ type: 'success', message: res?.message || 'Tao san pham thanh cong' });
      // tự tắt sau 3 giây
      setTimeout(() => {
        setNotice(null);
      }, 3000);
      fetchProductsFromBackend();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleUpdateProduct = async () => {
    try {
      setNotice(null);
      const payload = {};
      if (adminUpdate.name) payload.name = adminUpdate.name;
      if (adminUpdate.description) payload.description = adminUpdate.description;
      if (adminUpdate.linkImg) payload.linkImg = adminUpdate.linkImg;

      const res = await callApi(`/api/products/${adminUpdate.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      }, true);

      setNotice({ type: 'success', message: res?.message || 'Cap nhat san pham thanh cong' });
      // tự tắt sau 3 giây
      setTimeout(() => {
        setNotice(null);
      }, 3000);
      fetchProductsFromBackend();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleGetProductDetail = async (id) => {
  try {
    if (!id) return;

    const res = await callApi(
      `/api/products/getDetail/${id}`,
      {
        method: "GET",
      },
      true
    );

    const product = res?.data;

    if (!product) return;

    setAdminUpdate((prev) => ({
      ...prev,
      id: product.id,
      name: product.name || "",
      description: product.description || "",
      linkImg: product.linkImg || "",
    }));
  } catch (err) {
    console.log(err);
    setNotice({
      type: "error",
      message: "Không tìm thấy sản phẩm",
    });
    // tự tắt sau 3 giây
      setTimeout(() => {
        setNotice(null);
      }, 3000);
  }
};




  const handleDeleteProduct = async () => {
  // hiện popup xác nhận
  const confirmDelete = window.confirm(
    "Bạn có muốn xóa sản phẩm không?"
  );

  // nếu bấm Cancel thì dừng
  if (!confirmDelete) return;

  try {
    setNotice(null);

    const res = await callApi(
      `/api/products/${adminDeleteId}`,
      {
        method: "DELETE",
      },
      true
    );

    setNotice({
      type: "success",
      message:
        res?.message ||
        "Xóa sản phẩm thành công",
    });

    // tự tắt sau 3 giây
    setTimeout(() => {
      setNotice(null);
    }, 3000);

    // reset input
    setAdminDeleteId("");

    // load lại danh sách
    fetchProductsFromBackend();

  } catch (err) {
    setNotice({
      type: "error",
      message: err.message,
    });

    setTimeout(() => {
      setNotice(null);
    }, 3000);
  }
};

  const handleAddVariant = () => {
    setAdminCreate((prev) => ({
      ...prev,
      variants: [...prev.variants, { color: '', size: '', price: '', quantity: '' }]
    }));
  };

  const handleRemoveVariant = (index) => {
    setAdminCreate((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index)
    }));
  };

  const handleVariantChange = (index, key, value) => {
    setAdminCreate((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, idx) =>
        idx === index ? { ...variant, [key]: value } : variant
      )
    }));
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="navbar__brand">
          <span className="brand-mark">B</span>
          <div>
            <p className="brand-title">Biren</p>
            <p className="brand-subtitle">Fashion lab by Nhom 10</p>
          </div>
        </div>
        <nav className="navbar__links" aria-label="Chính">
          <button className="link" onClick={() => navigate('landing')}>Trang chủ</button>
          <button className="link" onClick={() => navigate('auth')}>Đăng nhập</button>
          <button className="link" onClick={() => navigate('shop')}>Sản phẩm</button>
        </nav>
        <div className="navbar__actions">
          <div className="badge">Giỏ hàng: {cart.length}</div>
          {user ? (
            <div className="user-pill">
              <span>{user.name}</span>
              <span className="role-badge">{user.role}</span>
              <button className="button button--ghost" onClick={handleLogout}>Đăng xuất</button>
            </div>
          ) : (
            <button className="button button--primary" onClick={() => navigate('auth')}>Bắt đầu</button>
          )}
        </div>
      </header>

      {notice && (
        <div className={`notice ${notice.type === 'error' ? 'notice--error' : 'notice--success'}`} aria-live="polite">
          {notice.message}
        </div>
      )}

      {page === 'landing' && (
        <main>
          <section className="hero">
            <div className="container hero__content">
              <div>
                <p className="eyebrow reveal">Nhóm 10 - Dự án Biren</p>
                <h1 className="hero__title reveal">Biren - shop quần áo sinh viên
                  <span className="hero__title-accent"> với phong cách trẻ trung</span>
                </h1>
                <p className="hero__subtitle reveal">
                  Biren là shop thời trang được xây dựng bởi 4 thành viên, tập trung vào
                  chất lượng ảnh sản phẩm, tốc độ tải trang nhanh, và trải nghiệm mua sắm
                  đơn giản cho người dùng.
                </p>
                <div className="hero__actions reveal">
                  <button className="button button--primary" onClick={() => navigate('auth')}>Đăng nhập / Đăng ký</button>
                  <button className="button button--secondary" onClick={() => navigate('shop')}>Xem sản phẩm</button>
                </div>
              </div>
              <div className="hero__panel reveal">
                <div className="panel-card">
                  <p className="panel-title">Tổng quan hệ thống</p>
                  <div className="panel-grid">
                    {metrics.map((item) => (
                      <div key={item.label} className="panel-item">
                        <p className="panel-value">{item.value}</p>
                        <p className="panel-label">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="panel-foot">
                    <span className="status-dot" />
                    <span>Backend đang hoạt động trên {BASE_URL}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section reveal">
            <div className="container">
              <div className="section-head">
                <h2>Về nhóm 10</h2>
                <p>Chia nhỏ vai trò rõ ràng: 1 backend, 3 frontend.</p>
              </div>
              <div className="grid grid--team">
                {teamMembers.map((member) => (
                  <article key={member.name} className="card">
                    <div className="card__badge">Thành viên</div>
                    <h3>{member.name}</h3>
                    <p>{member.role}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="section section--tint reveal">
            <div className="container">
              <div className="section-head">
                <h2>Vì sao chọn Biren?</h2>
                <p>Tập trung vào trải nghiệm mua sắm dành cho sinh viên.</p>
              </div>
              <div className="grid grid--features">
                <article className="card">
                  <h3>Danh mục gợi ý thông minh</h3>
                  <p>Hiển thị sản phẩm theo màu sắc, size và giá phù hợp với người dùng.</p>
                </article>
                <article className="card">
                  <h3>Quản trị rõ ràng (Role-based)</h3>
                  <p>USER chỉ xem sản phẩm, ADMIN có thể thêm - sửa - xóa.</p>
                </article>
                <article className="card">
                  <h3>Backend vững chắc</h3>
                  <p>Spring Boot cung cấp API JWT an toàn và ổn định cho hệ thống.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="section reveal">
            <div className="container">
              <div className="section-head">
                <h2>Sản phẩm nổi bật</h2>
                <p>Tham khảo nhanh 4 sản phẩm mới nhất từ hệ thống.</p>
              </div>
              <div className="grid grid--products">
                {landingProducts.map((product) => {
                  const firstVariant = product.variants?.[0];
                  const price = firstVariant ? firstVariant.price : null;
                  return (
                    <article key={product.id} className="card product-card">
                      <div className="product-media">
                        <img src={product.linkImg} alt={product.name} loading="lazy" />
                      </div>
                      <div className="product-body">
                        <div>
                          <h3>{product.name}</h3>
                          <p className="muted">{product.description}</p>
                        </div>
                        <div className="product-meta">
                          <span className="price">
                            {price !== null ? `${price.toLocaleString('vi-VN')} đ` : 'Liên hệ'}
                          </span>
                        </div>
                        <button className="button button--ghost" onClick={() => navigate('shop')}>Xem tất cả</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="section reveal">
            <div className="container cta">
              <div>
                <h2>Sẵn sàng khởi động?</h2>
                <p>Đăng nhập hoặc tạo tài khoản để vào cửa hàng Biren.</p>
              </div>
              <div className="cta__actions">
                <button className="button button--primary" onClick={() => navigate('auth')}>Bắt đầu ngay</button>
                <button className="button button--ghost" onClick={() => navigate('shop')}>Thử sản phẩm</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {page === 'auth' && (
        <main className="page">
          <section className="section">
            <div className="container">
              <div className="section-head">
                <h2>Đăng nhập hoặc Đăng ký</h2>
                <p>Đi đến trang sản phẩm sau khi đăng nhập thành công.</p>
              </div>
              <div className="grid grid--auth">
                <div className="card">
                  <h3>Đăng nhập</h3>
                  <label className="field">
                    <span>Tên đăng nhập</span>
                    <input
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Mật khẩu</span>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    />
                  </label>
                  <button className="button button--primary" onClick={handleLogin}>Đăng nhập</button>
                </div>

                <div className="card">
                  <h3>Đăng ký</h3>
                  <label className="field">
                    <span>Tên đăng nhập</span>
                    <input
                      type="text"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Mật khẩu</span>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Số điện thoại</span>
                    <input
                      type="text"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Họ và tên</span>
                    <input
                      type="text"
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                    />
                  </label>
                  <button className="button button--secondary" onClick={handleRegister}>Đăng ký</button>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {page === 'shop' && (
        <main className="page">
          <section className="section">
            <div className="container">
              <div className="section-head">
                <h2>Sản phẩm Biren</h2>
                <p>Danh sách sản phẩm lấy từ backend. USER chỉ xem, ADMIN quản trị.</p>
              </div>

              <div className="toolbar">
                <button className="button button--ghost" onClick={fetchProductsFromBackend}>Tải lại</button>
               
              </div>

              {loading && <p className="state">Đang tải sản phẩm...</p>}
              {error && <p className="state state--error">{error}</p>}

              {!loading && !error && (
                <div className="grid grid--products">
                  {products.map((product) => {
                    const firstVariant = product.variants?.[0];
                    const price = firstVariant ? firstVariant.price : null;
                    const stock = firstVariant ? firstVariant.quantity : null;
                    return (
                      <article key={product.id} className="card product-card">
                        <div className="product-media">
                          <img src={product.linkImg} alt={product.name} loading="lazy" />
                        </div>
                        <div className="product-body">
                          <div>
                            <h3>{product.name}</h3>
                            <p className="muted">{product.description}</p>
                          </div>
                          <div className="product-meta">
                            <span className="price">
                              {price !== null ? `${price.toLocaleString('vi-VN')} đ` : 'Liên hệ'}
                            </span>
                            <span className="stock">Tồn: {stock ?? '---'}</span>
                          </div>
                          <div className="product-actions">
                            <button className="button button--primary" onClick={() => handleAddToCart(product)}>Thêm vào giỏ</button>
                            <button className="button button--ghost" onClick={() => handleViewDetail(product.id)}>Xem chi tiết</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {detailLoading && <p className="state">Đang tải chi tiết...</p>}
              {selectedProduct && !detailLoading && (
                <div className="detail-card">
                  <h3>{selectedProduct.name}</h3>
                  <p>{selectedProduct.description}</p>
                  <div className="variant-table">
                    <div className="variant-table__head">
                      <span>Màu</span>
                      <span>Size</span>
                      <span>Giá</span>
                      <span>ồn</span>
                    </div>
                    {(selectedProduct.variants || []).map((variant) => (
                      <div key={variant.id} className="variant-table__row">
                        <span>{variant.color}</span>
                        <span>{variant.size}</span>
                        <span>{variant.price.toLocaleString('vi-VN')} đ</span>
                        <span>{variant.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="section section--tint">
            <div className="container">
              <div className="section-head">
                <h2>Quản trị sản phẩm</h2>
                <p>Chỉ ADMIN mới có quyền thao tác.</p>
              </div>

              {!isAdmin && (
                <div className="notice notice--warning">
                  Bạn đang ở role USER. Vui lòng đăng nhập ADMIN để thao tác.
                </div>
              )}

              {isAdmin && (
                <div className="grid grid--admin">
                  <div className="card">
                    <h3>Tạo sản phẩm</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>Tên sản phẩm</span>
                        <input
                          type="text"
                          value={adminCreate.name}
                          onChange={(e) => setAdminCreate({ ...adminCreate, name: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Mô tả</span>
                        <input
                          type="text"
                          value={adminCreate.description}
                          onChange={(e) => setAdminCreate({ ...adminCreate, description: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Link ảnh</span>
                        <input
                          type="text"
                          value={adminCreate.linkImg}
                          onChange={(e) => setAdminCreate({ ...adminCreate, linkImg: e.target.value })}
                        />
                      </label>
                      <div className="variant-list">
                        <div className="variant-list__head">
                          <span>Biến thể</span>
                          <button className="button button--ghost" type="button" onClick={handleAddVariant}>Thêm variant</button>
                        </div>
                        {adminCreate.variants.map((variant, index) => (
                          <div key={`variant-${index}`} className="variant-row">
                            <label className="field">
                              <span>Màu sắc</span>
                              <input
                                type="text"
                                value={variant.color}
                                onChange={(e) => handleVariantChange(index, 'color', e.target.value)}
                              />
                            </label>
                            <label className="field">
                              <span>Size</span>
                              <input
                                type="text"
                                value={variant.size}
                                onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                              />
                            </label>
                            <label className="field">
                              <span>Gia</span>
                              <input
                                type="number"
                                value={variant.price}
                                onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                              />
                            </label>
                            <label className="field">
                              <span>Số lượng</span>
                              <input
                                type="number"
                                value={variant.quantity}
                                onChange={(e) => handleVariantChange(index, 'quantity', e.target.value)}
                              />
                            </label>
                            {adminCreate.variants.length > 1 && (
                              <button className="button button--danger" type="button" onClick={() => handleRemoveVariant(index)}>Xóa</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button className="button button--primary" onClick={handleCreateProduct}>Tạo sản phẩm</button>
                  </div>

                 <div className="card">
                    <h3>Cập nhật sản phẩm</h3>
                    <div className="form-grid">
                      <label className="field">
                        <span>ID sản phẩm</span>
                        <input
                          type="number"
                          value={adminUpdate.id}
                          onChange={(e) => {
                            const value = e.target.value;

                            setAdminUpdate({
                              ...adminUpdate,
                              id: value,
                            });

                            // tự động gọi API khi nhập id
                            if (value) {
                              handleGetProductDetail(value);
                            }
                          }}
                        />
                      </label>
                      <label className="field">
                        <span>Tên mới</span>
                        <input
                          type="text"
                          value={adminUpdate.name}
                          onChange={(e) => setAdminUpdate({ ...adminUpdate, name: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Mô tả mới</span>
                        <input
                          type="text"
                          value={adminUpdate.description}
                          onChange={(e) => setAdminUpdate({ ...adminUpdate, description: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Link ảnh mới</span>
                        <input
                          type="text"
                          value={adminUpdate.linkImg}
                          onChange={(e) => setAdminUpdate({ ...adminUpdate, linkImg: e.target.value })}
                        />
                      </label>
                    </div>
                    <button className="button button--secondary" onClick={handleUpdateProduct}>Cập nhật</button>
                  </div>
                  
                  <div className="card">
                    <h3>Xóa sản phẩm</h3>
                    <label className="field">
                      <span>ID sản phẩm</span>
                      <input
                        type="number"
                        value={adminDeleteId}
                        onChange={(e) => setAdminDeleteId(e.target.value)}
                      />
                    </label>
                    <button className="button button--danger" onClick={handleDeleteProduct}>Xóa sản phẩm</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      <footer className="footer">
        <div className="container footer__content">
          <div>
            <p className="footer__brand">Biren Fashion Studio</p>
            <p className="muted">Built by Nhóm 10 - Java Spring Boot + React.</p>
          </div>
          <div className="footer__links">
            <button className="link" onClick={() => navigate('landing')}>Trang chủ</button>
            <button className="link" onClick={() => navigate('auth')}>Đăng nhập</button>
            <button className="link" onClick={() => navigate('shop')}>Sản phẩm</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;