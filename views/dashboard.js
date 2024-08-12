const sideLinks = document.querySelectorAll('.sidebar .side-menu li a:not(.logout)');
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@10"></script>


sideLinks.forEach(item => {
    const li = item.parentElement;
    item.addEventListener('click', () => {
        sideLinks.forEach(i => {
            i.parentElement.classList.remove('active');
        })
        li.classList.add('active');
    })
});

const menuBar = document.querySelector('.content nav .bx.bx-menu');
const sideBar = document.querySelector('.sidebar');

menuBar.addEventListener('click', () => {
    sideBar.classList.toggle('close');
});

const searchBtn = document.querySelector('.content nav form .form-input button');
const searchBtnIcon = document.querySelector('.content nav form .form-input button .bx');
const searchForm = document.querySelector('.content nav form');

searchBtn.addEventListener('click', function (e) {
    if (window.innerWidth < 576) {
        e.preventDefault;
        searchForm.classList.toggle('show');
        if (searchForm.classList.contains('show')) {
            searchBtnIcon.classList.replace('bx-search', 'bx-x');
        } else {
            searchBtnIcon.classList.replace('bx-x', 'bx-search');
        }
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth < 768) {
        sideBar.classList.add('close');
    } else {
        sideBar.classList.remove('close');
    }
    if (window.innerWidth > 576) {
        searchBtnIcon.classList.replace('bx-x', 'bx-search');
        searchForm.classList.remove('show');
    }
});

const toggler = document.getElementById('theme-toggle');

toggler.addEventListener('change', function () {
    if (this.checked) {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
});

    document.addEventListener('DOMContentLoaded', function() {
      document.querySelector('.logout1').addEventListener('click', function(event) {
        event.preventDefault(); // Impede o comportamento padrão do link

        Swal.fire({
          icon: 'info',
          title: 'Em breve!',
          text: 'A opção de compra de créditos estará disponível em breve.',
        });
      });
    });

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('.logout').addEventListener('click', function (event) {
    event.preventDefault(); // Evitar o comportamento padrão do link

    Swal.fire({
      title: "Deseja realmente sair?",
      text: "Você será desconectado.",
      icon: 'warning',
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sim, sair",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
    }).then((result) => {
      if (result.isConfirmed) {
        // O usuário confirmou o logout
        realizarLogout();
      } else {
        // O usuário cancelou o logout
        console.log("Logout cancelado");
      }
    });
  });
});

function realizarLogout() {
  // Exibir o alerta "Auto close" com um timer
  let timerInterval;
  Swal.fire({
    title: "Terminar sessão",
    html: "Saindo em <b></b> milissegundos.",
    timer: 2000,
    timerProgressBar: true,
    didOpen: () => {
      Swal.showLoading();
      const timer = Swal.getPopup().querySelector("b");
      timerInterval = setInterval(() => {
        timer.textContent = `${Swal.getTimerLeft()}`;
      }, 100);
    },
    willClose: () => {
      clearInterval(timerInterval);
      // Após o alerta ser fechado, realizar o logout
      window.location.href = "/logout"; // Redireciona para a página de logout
    }
  });
}


