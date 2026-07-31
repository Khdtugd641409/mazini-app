function HomePage({ onOpenCustomerApplication }) {
  return (
    <main>
      <h1>نايف المزيني للبناء الذاتي</h1>
      <p>منصة البناء الذاتي الممول</p>

      <button type="button" onClick={onOpenCustomerApplication}>
        تقديم طلب عميل
      </button>
    </main>
  );
}

export default HomePage;
