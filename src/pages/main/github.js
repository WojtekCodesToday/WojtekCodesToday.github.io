import forkIcon from "../../assets/github/fork.svg"
import linkIcon from "../../assets/github/link.svg"
export function Repo(repository) {
    const isValidHomepage = repository.homepage && repository.homepage.trim() !== '';
    const jhtml = {
        "a": {
            "href": `https://github.com/${repository.fullName}`,
            "target": "_blank",
            "child": {
                "div-0": {
                    "class": "repo",
                    "child": {
                        "div-0": {
                            "class": "repoName",
                            "child":{}
                        },
                        "div-1": {
                            "class": "updated",
                            "child": `(updated ${repository.updated_at})`
                        },
                        "p-2": {
                            "child": `${typeof repository.desc !== "undefined" && repository.desc}`
                        }
                    }
                }
            }
        }
    }

    jhtml.a.child["div-0"].child["div-0"].child = (repository.fork) ? {
        "img-0": {
            "src": forkIcon,
            "class": "fork-icon"
        },
        "p-1": {
            "child": `${repository.name}`
        }
    } : {
        "p-1": {
            "child": `${repository.name}`
        }
    };
    if (isValidHomepage) {
        jhtml.a.child["div-0"].child["a-2"] = {
            "target": "_blank",
            "rel": "noopener noreferrer",
            "href": repository.homepage,
            "child": {
                "div": {
                    "child": {
                        "img": {
                            "src": linkIcon,
                            "class": "fork-icon",
                            "child":repository.homepage
                        }
                    }
                }
            }
        }
    }


    /*<Link key={repository.fullName} to={} target="_blank">
    <div className={`repo`}>
    <div className='repoName'>
    {repository.fork && <img src={forkIcon} className="fork-icon" />}
    <p>{repository.name}</p>
    </div>
    <div className='updated'>(updated {repository.updated_at})</div>
                <p>{repository.desc}</p>
                {isValidHomepage && (
                    <Link to={repository.homepage} target="_blank" rel="noopener noreferrer">
                    <div><img src={linkIcon} className="fork-icon" />{repository.homepage}</div>
                    </Link>
                    )}
                    </div>
                    </Link>*/
    return jhtml;
};
export async function github() {
    let repos = [];
    let success = true;
    const jhtml = {
        "div": {
            "class": "card",
            "child": {
                "div-0": {
                    "class": "column",
                    "child": {}
                },
                "div-1": {
                    "class": "column",
                    "child": {}
                }
            }
        }
    };

    const fetchRepos = async () => {
      try {
        const userResponse = await fetch('https://api.github.com/users/WojtekCodesToday');
        const userData = await userResponse.json();
        const totalRepos = userData.public_repos;
        const perPage = 30;
        const totalPages = Math.ceil(totalRepos / perPage);

        let allRepos = [];
        for (let page = 1; page <= totalPages; page++) {
          const response = await fetch(`https://api.github.com/users/WojtekCodesToday/repos?page=${page}`);
          const data = await response.json();
          allRepos = allRepos.concat(data);
        }

        const sortedRepos = allRepos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        const repoDetails = sortedRepos.map(repo => ({
          name: repo.name,
          fullName: repo.full_name,
          desc: repo.description,
          updated_at: repo.updated_at,
          fork: repo.fork,
          archived: repo.archived,
          homepage: repo.homepage
        }));

        return repoDetails;
      } catch (error) {
        success = false;
        console.error('Error fetching repos:', error);
        return {"h3-0":{"child":`${error}`}};
      }
    };
    
    repos = await fetchRepos();
    if (success){

        const filteredRepos = repos.filter(repo => (!repo.fork) && !repo.archived);
        const leftColumnRepos = filteredRepos.filter((_, index) => index % 2 === 0);
        const rightColumnRepos = filteredRepos.filter((_, index) => index % 2 !== 0);
        
        const leftColumnChildren = {};
        leftColumnRepos.forEach((repo, i) => {
            leftColumnChildren[`a-${i}`] = Repo(repo)["a"];
        });
        jhtml.div.child["div-0"].child = leftColumnChildren;
        
        const rightColumnChildren = {};
        rightColumnRepos.forEach((repo, i) => {
            rightColumnChildren[`a-${i}`] = Repo(repo)["a"];
        });
        jhtml.div.child["div-1"].child = rightColumnChildren;
        return jhtml;
    } else {
        return repos;
    }
}