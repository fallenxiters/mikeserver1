        document.addEventListener('DOMContentLoaded', function () {
            toggleSidebar();
        });

        function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openbtn = document.getElementById('sidebarToggle');
    const sidebarIcon = document.getElementById('sidebarIcon');

    if (sidebar.style.left === '-250px') { // Alterado de '0px' para '-250px'
        sidebar.style.left = '0';
        openbtn.style.left = '260px';
        sidebarIcon.classList.remove('fa-bars');
        sidebarIcon.classList.add('fa-times');
    } else {
        sidebar.style.left = '-250px';
        openbtn.style.left = '20px';
        sidebarIcon.classList.remove('fa-times');
        sidebarIcon.classList.add('fa-bars');
    }
}

        $(document).ready(function () {
            $('#vendedor-selector').select2(); // Inicialize o Select2
            $('#vendedor-selector').change(function () {
                var selectedVendedor = $(this).val();

                if (selectedVendedor === "all") {
                    $('.user-row').show();
                } else {
                    $('.user-row').hide();
                    $('.user-row td:contains(' + selectedVendedor + ')').parent().show();
                }
            });
        });

        document.addEventListener('DOMContentLoaded', function () {
            const sideLinks = document.querySelectorAll('.sidebar .side-menu li a:not(.logout)');

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
                    e.preventDefault();
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

function toggleSearchInput() {
    var searchInput = document.getElementById('searchInput');

    // Alterna a visibilidade do campo de pesquisa
    if (searchInput.style.visibility === 'hidden' || searchInput.style.visibility === '') {
      searchInput.style.visibility = 'visible';
      searchInput.focus(); // Foca no campo de pesquisa
    } else {
      performSearch();
    }
  }

  function performSearch() {
    // Lógica de pesquisa aqui
  }

document.addEventListener('DOMContentLoaded', function () {
    var searchIcon = document.getElementById('searchIcon');
    var searchInput = document.getElementById('searchInput');

    // Ao clicar no ícone de pesquisa
    searchIcon.addEventListener('click', function () {
        // Alterna a visibilidade do campo de pesquisa
        if (searchInput.style.visibility === 'hidden' || searchInput.style.visibility === '') {
            searchInput.style.visibility = 'visible';
            searchInput.focus(); // Foca no campo de pesquisa
        } else {
            performSearch();
        }
    });

    // Ao perder o foco no campo de pesquisa, oculta-o
    searchInput.addEventListener('blur', function () {
        searchInput.style.visibility = 'hidden';
    });

    // Ao pressionar Enter no campo de pesquisa, executa a pesquisa
    searchInput.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    // Função para realizar a pesquisa
    function performSearch() {
        var searchValue = searchInput.value.toLowerCase();
        var rows = document.querySelectorAll('.table-container table tbody tr');

        var userFound = false;

        rows.forEach(function (row) {
            var username = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
            var visible = username.includes(searchValue);

            row.style.display = visible ? '' : 'none';

            if (visible) {
                userFound = true;
            }
        });

        // Se nenhum usuário for encontrado, exibe uma mensagem na tabela
        if (!userFound) {
            var tableBody = document.querySelector('.table-container table tbody');
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum usuário encontrado</td></tr>';
        }
    }
});

    // Função para deletar keys expiradas
    document.getElementById('deleteExpiredKeys').addEventListener('click', () => {
        Swal.fire({
            title: 'Tem certeza?',
            text: "Você realmente deseja deletar todas as keys expiradas?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Deletar'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch('/delete-expired-keys', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).then(response => {
                    if (response.ok) {
                        Swal.fire(
                            'Deletado!',
                            'Todas as keys expiradas foram deletadas.',
                            'success'
                        ).then(() => {
                            location.reload();
                        });
                    } else {
                        Swal.fire(
                            'Erro!',
                            'Houve um problema ao deletar as keys expiradas.',
                            'error'
                        );
                    }
                });
            }
        });
    });

    // Função para resetar tudo
    document.getElementById('resetAll').addEventListener('click', () => {
        Swal.fire({
            title: 'Tem certeza?',
            text: "Você realmente deseja resetar tudo?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Resetar'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch('/reset-all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).then(response => {
                    if (response.ok) {
                        Swal.fire(
                            'Resetado!',
                            'Todos os dados foram resetados.',
                            'success'
                        ).then(() => {
                            location.reload();
                        });
                    } else {
                        Swal.fire(
                            'Erro!',
                            'Houve um problema ao resetar todos os dados.',
                            'error'
                        );
                    }
                });
            }
        });
    });
